import { decrypt } from '@/lib/encryption/decrypt';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCommunityManagerAccess } from '@/lib/community/community-manager/utils';
import { getSiteMembership, getStaffMembersAccess } from '@/lib/users/utils';
import { normalizeText } from '@/lib/utils';
import {
  type MemberRestrictionMessage,
  type MemberRestrictionMessageSenderType,
  type MemberRestrictionType,
} from '@/lib/users/memberRestrictionMessages';

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
};

type StigmaRow = {
  id: string;
  user_name: string | null;
};

type MembershipRow = {
  id: string;
  user_id: string;
  nickname: string | null;
  is_block: boolean;
  blocked_at: string | null;
  block_reason: string | null;
  kicked_at: string | null;
  kick_reason: string | null;
  banned_at: string | null;
  ban_reason: string | null;
};

type MessageRow = {
  id: string;
  membership_id: string;
  restriction_type: MemberRestrictionType;
  sender_stigma_id: string;
  sender_type: MemberRestrictionMessageSenderType;
  message: string;
  created_at: string;
};

export type MemberRestrictionMessageContext = {
  site: SiteRow;
  membership: MembershipRow;
  actorStigmaId: string;
  actorType: MemberRestrictionMessageSenderType;
  memberName: string;
  restrictionType: MemberRestrictionType;
  restrictionReason: string;
};

function decryptName(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  try {
    return decrypt(normalizedValue);
  } catch {
    return '';
  }
}

function getRestrictionReason(membership: MembershipRow, restrictionType: MemberRestrictionType) {
  if (restrictionType === 'block') {
    return normalizeText(membership.block_reason) || '등록된 활동정지 사유가 없습니다.';
  }

  if (restrictionType === 'kick') {
    return normalizeText(membership.kick_reason) || '등록된 강제탈퇴 사유가 없습니다.';
  }

  return normalizeText(membership.ban_reason) || '등록된 가입불가 사유가 없습니다.';
}

function isRestrictionActive(membership: MembershipRow, restrictionType: MemberRestrictionType) {
  if (restrictionType === 'block') {
    return membership.is_block === true && Boolean(membership.blocked_at);
  }

  if (restrictionType === 'kick') {
    return Boolean(membership.kicked_at);
  }

  return Boolean(membership.banned_at);
}

async function loadMemberName(membership: MembershipRow) {
  const supabaseAdmin = getSupabaseAdmin();
  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('id, user_name')
    .eq('id', membership.user_id)
    .maybeSingle();

  if (stigmaResult.error) {
    throw new Error('회원 정보를 불러오지 못했습니다.');
  }

  const stigma = stigmaResult.data as StigmaRow | null;

  return normalizeText(membership.nickname) || decryptName(stigma?.user_name) || '사용자';
}

export async function loadAppellantRestrictionMessageContext({
  siteName,
  restrictionType,
}: {
  siteName: string;
  restrictionType: MemberRestrictionType;
}) {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims) {
    throw new Error('로그인이 필요합니다.');
  }

  const supabaseAdmin = getSupabaseAdmin();
  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_label')
    .eq('site_key', siteName)
    .maybeSingle();

  if (siteResult.error || !siteResult.data) {
    throw new Error('사이트 정보를 찾을 수 없습니다.');
  }

  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('id, user_name')
    .eq('user_id', sessionClaims.userId)
    .maybeSingle();

  if (stigmaResult.error || !stigmaResult.data) {
    throw new Error('회원 정보를 찾을 수 없습니다.');
  }

  const membershipResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select(
      'id, user_id, nickname, is_block, blocked_at, block_reason, kicked_at, kick_reason, banned_at, ban_reason',
    )
    .eq('site_id', siteResult.data.id)
    .eq('user_id', stigmaResult.data.id)
    .maybeSingle();

  if (membershipResult.error || !membershipResult.data) {
    throw new Error('사이트 회원 정보를 찾을 수 없습니다.');
  }

  const membership = membershipResult.data as MembershipRow;

  if (!isRestrictionActive(membership, restrictionType)) {
    throw new Error('현재 소명할 수 있는 제재 내역이 없습니다.');
  }

  return {
    site: siteResult.data as SiteRow,
    membership,
    actorStigmaId: stigmaResult.data.id as string,
    actorType: 'appellant',
    memberName: normalizeText(membership.nickname) || decryptName(stigmaResult.data.user_name) || '사용자',
    restrictionType,
    restrictionReason: getRestrictionReason(membership, restrictionType),
  } satisfies MemberRestrictionMessageContext;
}

export async function loadStaffRestrictionMessageContext({
  siteName,
  memberStigmaId,
  restrictionType,
}: {
  siteName: string;
  memberStigmaId: string;
  restrictionType: MemberRestrictionType;
}) {
  const access = await getStaffMembersAccess(siteName);

  if (!access.ok) {
    throw new Error(access.error);
  }

  const managerAccess = await getCommunityManagerAccess(siteName);

  if (!managerAccess.actor.permissions.member_manage || !access.session.stigmaId) {
    throw new Error('접근 권한이 없습니다.');
  }

  const membershipResult = await getSiteMembership(access.site.id, memberStigmaId);

  if (!membershipResult.ok) {
    throw new Error(membershipResult.error);
  }

  const membership = membershipResult.membership as MembershipRow;

  if (!isRestrictionActive(membership, restrictionType)) {
    throw new Error('현재 답변할 수 있는 제재 내역이 없습니다.');
  }

  const siteResult = await access.supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_label')
    .eq('id', access.site.id)
    .maybeSingle();

  if (siteResult.error || !siteResult.data) {
    throw new Error('사이트 정보를 찾을 수 없습니다.');
  }

  return {
    site: siteResult.data as SiteRow,
    membership,
    actorStigmaId: access.session.stigmaId,
    actorType: 'staff',
    memberName: await loadMemberName(membership),
    restrictionType,
    restrictionReason: getRestrictionReason(membership, restrictionType),
  } satisfies MemberRestrictionMessageContext;
}

export async function loadMemberRestrictionMessages(context: MemberRestrictionMessageContext) {
  const supabaseAdmin = getSupabaseAdmin();
  const messagesResult = await supabaseAdmin
    .from('member_restriction_messages')
    .select('id, membership_id, restriction_type, sender_stigma_id, sender_type, message, created_at')
    .eq('membership_id', context.membership.id)
    .eq('restriction_type', context.restrictionType)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (messagesResult.error) {
    throw new Error('소명 메시지를 불러오지 못했습니다.');
  }

  const siteName = context.site.site_label || context.site.site_key;
  const messages = ((messagesResult.data ?? []) as MessageRow[]).map(
    (message): MemberRestrictionMessage => ({
      id: message.id,
      senderType: message.sender_type,
      senderName: message.sender_type === 'staff' ? siteName : context.memberName,
      message: message.message,
      createdAt: message.created_at,
    }),
  );

  return {
    siteName,
    restrictionReason: context.restrictionReason,
    messages,
  };
}

export async function createMemberRestrictionMessage({
  context,
  message,
}: {
  context: MemberRestrictionMessageContext;
  message: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const insertResult = await supabaseAdmin.from('member_restriction_messages').insert({
    membership_id: context.membership.id,
    restriction_type: context.restrictionType,
    sender_stigma_id: context.actorStigmaId,
    sender_type: context.actorType,
    message,
  });

  if (insertResult.error) {
    throw new Error('소명 메시지를 저장하지 못했습니다.');
  }

  return loadMemberRestrictionMessages(context);
}

export async function loadRestrictionLastSenderMap({
  membershipIds,
  restrictionTypes,
}: {
  membershipIds: string[];
  restrictionTypes: MemberRestrictionType[];
}) {
  const lastSenderMap = new Map<string, MemberRestrictionMessageSenderType>();

  if (membershipIds.length === 0 || restrictionTypes.length === 0) {
    return lastSenderMap;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const messagesResult = await supabaseAdmin
    .from('member_restriction_messages')
    .select('membership_id, restriction_type, sender_type, created_at, id')
    .in('membership_id', membershipIds)
    .in('restriction_type', restrictionTypes)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (messagesResult.error) {
    throw new Error('소명 메시지 상태를 불러오지 못했습니다.');
  }

  for (const message of (messagesResult.data ?? []) as MessageRow[]) {
    lastSenderMap.set(`${message.membership_id}:${message.restriction_type}`, message.sender_type);
  }

  return lastSenderMap;
}

export async function deleteMemberRestrictionMessages({
  membershipIds,
  restrictionTypes,
}: {
  membershipIds: string[];
  restrictionTypes: MemberRestrictionType[];
}) {
  if (membershipIds.length === 0 || restrictionTypes.length === 0) {
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const deleteResult = await supabaseAdmin
    .from('member_restriction_messages')
    .delete()
    .in('membership_id', membershipIds)
    .in('restriction_type', restrictionTypes);

  if (deleteResult.error) {
    throw new Error('기존 소명 메시지를 삭제하지 못했습니다.');
  }
}
