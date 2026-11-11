import crypto from 'crypto';
import { r2Storage } from '@/lib/clients/r2Storage';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';

export const COMMUNITY_CHAT_MIN_MEMBERS = 2;
export const COMMUNITY_CHAT_MAX_LENGTH = 1000;
export const COMMUNITY_CHAT_PAGE_SIZE = 50;
export const COMMUNITY_CHAT_RETENTION_DAYS = 30;

const TOKEN_LIFETIME_SECONDS = 60 * 10;
const AVATAR_BUCKET = 'avatar';

export type CommunityChatMessage = {
  id: string;
  stigmaId: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
};

type ChatMembership = {
  rhizomeStigmaId: string;
  role: string;
  isApproval: boolean;
  isRestricted: boolean;
};

function getChatSecret() {
  const secret = process.env.COMMUNITY_CHAT_SECRET?.trim();

  if (!secret) {
    throw new Error('COMMUNITY_CHAT_SECRET가 설정되지 않았습니다.');
  }

  return secret;
}

export function getCommunityChatWorkerUrl() {
  const workerUrl = process.env.NEXT_PUBLIC_COMMUNITY_CHAT_WORKER_URL?.trim().replace(/\/+$/, '');

  if (!workerUrl) {
    throw new Error('NEXT_PUBLIC_COMMUNITY_CHAT_WORKER_URL이 설정되지 않았습니다.');
  }

  return workerUrl;
}

function toBase64Url(value: Buffer | string) {
  return Buffer.from(value).toString('base64url');
}

export function createCommunityChatToken(siteId: string, stigmaId: string) {
  const payload = toBase64Url(
    JSON.stringify({ siteId, stigmaId, exp: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS }),
  );
  const signature = toBase64Url(crypto.createHmac('sha256', getChatSecret()).update(payload).digest());

  return `${payload}.${signature}`;
}

export function isCommunityChatWorkerRequest(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${getChatSecret()}`;
  const receivedBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);

  return receivedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function callCommunityChatWorker(path: string, init: RequestInit = {}) {
  const response = await fetch(`${getCommunityChatWorkerUrl()}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${getChatSecret()}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('채팅 서버와 연결하지 못했습니다.');
  }

  return response;
}

function getAvatarUrl(value: string | null | undefined) {
  const avatar = normalizeText(value);

  if (!avatar) return null;
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar;

  return r2Storage.from(AVATAR_BUCKET).getPublicUrl(avatar).data.publicUrl || null;
}

export async function countCommunityChatMembers(siteId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const countResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('is_approval', true)
    .eq('is_block', false)
    .is('kicked_at', null)
    .is('banned_at', null)
    .is('withdrawn_at', null);

  if (countResult.error) {
    throw new Error('가입 멤버 수를 불러오지 못했습니다.');
  }

  return countResult.count ?? 0;
}

async function getChatMembership(siteId: string, stigmaId: string): Promise<ChatMembership | null> {
  const supabaseAdmin = getSupabaseAdmin();
  const membershipResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('id, role, is_approval, is_block, kicked_at, banned_at, withdrawn_at')
    .eq('site_id', siteId)
    .eq('user_id', stigmaId)
    .maybeSingle();

  if (membershipResult.error || !membershipResult.data) {
    return null;
  }

  const membership = membershipResult.data;

  return {
    rhizomeStigmaId: membership.id as string,
    role: normalizeText(membership.role),
    isApproval: membership.is_approval === true,
    isRestricted:
      membership.is_block === true ||
      Boolean(membership.kicked_at) ||
      Boolean(membership.banned_at) ||
      Boolean(membership.withdrawn_at),
  };
}

async function isCommunityManager(siteId: string, rhizomeStigmaId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const communityResult = await supabaseAdmin.from('communities').select('id').eq('site_id', siteId).maybeSingle();

  if (communityResult.error || !communityResult.data?.id) {
    return false;
  }

  const manageRoleResult = await supabaseAdmin
    .from('community_manage_role')
    .select('role')
    .eq('community_id', communityResult.data.id)
    .eq('manager_id', rhizomeStigmaId)
    .eq('role', 'community-manager')
    .limit(1);

  return !manageRoleResult.error && (manageRoleResult.data ?? []).length > 0;
}

export async function getCommunityChatContext(siteName: string) {
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const supabaseAdmin = getSupabaseAdmin();
  const rhizomeResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_type, is_shutdown')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (
    rhizomeResult.error ||
    !rhizomeResult.data ||
    rhizomeResult.data.site_type !== 'community' ||
    rhizomeResult.data.is_shutdown !== false
  ) {
    return null;
  }

  const siteId = rhizomeResult.data.id as string;
  const [session, roomResult] = await Promise.all([
    verifySession({ siteId }),
    supabaseAdmin.from('community_chat_rooms').select('site_id').eq('site_id', siteId).maybeSingle(),
  ]);
  const membership = session.stigmaId ? await getChatMembership(siteId, session.stigmaId) : null;
  const isActiveMember = Boolean(membership && !membership.isRestricted);
  const isOwner = isActiveMember && membership?.role === 'owner';
  const isStaff = isActiveMember && (membership?.role === 'owner' || membership?.role === 'manager');
  const canUse = isStaff || (isActiveMember && membership?.role === 'member' && membership.isApproval);
  const canDelete =
    isOwner ||
    (isActiveMember && membership?.role === 'manager') ||
    (isActiveMember && membership ? await isCommunityManager(siteId, membership.rhizomeStigmaId) : false);

  return {
    siteId,
    stigmaId: session.stigmaId,
    isOpen: Boolean(roomResult.data),
    isOwner,
    canUse,
    canDelete: canUse && canDelete,
  };
}

export async function getCommunityChatAuthor(siteId: string, stigmaId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const [stigmaResult, membershipResult] = await Promise.all([
    supabaseAdmin.from('stigmas').select('user_name, avatar').eq('id', stigmaId).maybeSingle(),
    supabaseAdmin
      .from('rhizome_stigmas')
      .select('nickname')
      .eq('site_id', siteId)
      .eq('user_id', stigmaId)
      .maybeSingle(),
  ]);

  let name = normalizeText(membershipResult.data?.nickname);

  if (!name && stigmaResult.data?.user_name) {
    try {
      name = decrypt(stigmaResult.data.user_name as string);
    } catch {
      name = '';
    }
  }

  return {
    name: name || '알 수 없음',
    avatarUrl: getAvatarUrl(stigmaResult.data?.avatar),
  };
}

export function getCommunityChatRetentionDate() {
  return new Date(Date.now() - COMMUNITY_CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}
