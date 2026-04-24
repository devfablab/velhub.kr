import { decrypt } from '@/lib/encryption/decrypt';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SiteType = 'community';

type SiteRow = {
  id: string;
  site_key: string;
  site_type: string | null;
  visibility_type: string | null;
  is_shutdown: boolean | null;
};

type SitesRow = {
  visibility_member: string | null;
};

type MembershipRow = {
  id: string;
  created_at?: string;
  user_id: string;
  site_id: string;
  is_approval: boolean;
  blocked_at: string | null;
  block_count: number;
  approval_at: string | null;
  is_block: boolean;
  role: string | null;
  nickname: string | null;
  post_count: number;
  comment_count: number;
  checkin_count: number;
  last_checkin_at: string;
  handled_at: string | null;
  handled_by: string | null;
  staff_note: string | null;
  answered_questions: unknown;
  lv: string | null;
  like_count: number | null;
  kicked_at: string | null;
  kicked_by: string | null;
  banned_at: string | null;
  banned_by: string | null;
  blocked_by?: string | null;
};

type StigmaRow = {
  id: string;
  email: string | null;
  avatar: string | null;
};

type LevelRow = {
  id: string;
  lv: number;
  name: string | null;
  icon: string | null;
};

const LEVEL_ICON_BUCKET = 'lv-icon';

function isCommunitySiteType(value: string | null | undefined): value is SiteType {
  return value === 'community';
}

export function decryptNullable(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return null;
  }

  try {
    return decrypt(normalizedValue);
  } catch {
    return null;
  }
}

export function getLevelIconUrl(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue || !normalizedValue.startsWith('supabase:')) {
    return '';
  }

  const storagePath = normalizedValue.replace('supabase:', '').trim();

  if (!storagePath) {
    return '';
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from(LEVEL_ICON_BUCKET).getPublicUrl(storagePath);

  return publicUrl.data.publicUrl ?? '';
}

export async function getPublicMembersAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_type, visibility_type, is_shutdown')
    .eq('site_key', siteName)
    .maybeSingle();

  if (siteResult.error || !siteResult.data) {
    return {
      ok: false,
      status: 404,
      error: '사이트를 찾을 수 없습니다.',
    } as const;
  }

  const site = siteResult.data as SiteRow;

  if (!isCommunitySiteType(site.site_type)) {
    return {
      ok: false,
      status: 403,
      error: '커뮤니티만 사용할 수 있습니다.',
    } as const;
  }

  const sitesResult = await supabaseAdmin
    .from('sites')
    .select('visibility_member')
    .eq('site_id', site.id)
    .maybeSingle();

  if (sitesResult.error || !sitesResult.data) {
    return {
      ok: false,
      status: 500,
      error: '사이트 멤버 설정을 불러오지 못했습니다.',
    } as const;
  }

  const sites = sitesResult.data as SitesRow;

  if (sites.visibility_member !== 'public' || site.visibility_type !== 'public' || site.is_shutdown === true) {
    return {
      ok: false,
      status: 403,
      error: '조회할 수 없습니다.',
    } as const;
  }

  return {
    ok: true,
    supabaseAdmin,
    site,
  } as const;
}

export async function getStaffMembersAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_type')
    .eq('site_key', siteName)
    .maybeSingle();

  if (siteResult.error || !siteResult.data) {
    return {
      ok: false,
      status: 404,
      error: '사이트를 찾을 수 없습니다.',
    } as const;
  }

  const site = siteResult.data as Pick<SiteRow, 'id' | 'site_key' | 'site_type'>;

  if (!isCommunitySiteType(site.site_type)) {
    return {
      ok: false,
      status: 403,
      error: '커뮤니티만 사용할 수 있습니다.',
    } as const;
  }

  const session = await verifySession({
    siteId: site.id,
  });

  if (session.case !== 'staff' || !session.stigmaId) {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }

  return {
    ok: true,
    supabaseAdmin,
    site,
    session,
  } as const;
}

export async function getPublicActiveMemberships(siteId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const membershipResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('*')
    .eq('site_id', siteId)
    .eq('is_approval', true)
    .eq('is_block', false)
    .is('kicked_at', null)
    .is('banned_at', null);

  if (membershipResult.error) {
    return {
      ok: false,
      error: '멤버 정보를 불러오지 못했습니다.',
    } as const;
  }

  return {
    ok: true,
    memberships: (membershipResult.data ?? []) as MembershipRow[],
  } as const;
}

export async function getPublicActiveMembership(siteId: string, userId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const membershipResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('*')
    .eq('site_id', siteId)
    .eq('user_id', userId)
    .eq('is_approval', true)
    .eq('is_block', false)
    .is('kicked_at', null)
    .is('banned_at', null)
    .maybeSingle();

  if (membershipResult.error) {
    return {
      ok: false,
      status: 500,
      error: '멤버 정보를 불러오지 못했습니다.',
    } as const;
  }

  if (!membershipResult.data) {
    return {
      ok: false,
      status: 404,
      error: '멤버 정보를 찾을 수 없습니다.',
    } as const;
  }

  return {
    ok: true,
    membership: membershipResult.data as MembershipRow,
  } as const;
}

export async function getSiteMembership(siteId: string, userId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const membershipResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('*')
    .eq('site_id', siteId)
    .eq('user_id', userId)
    .maybeSingle();

  if (membershipResult.error) {
    return {
      ok: false,
      status: 500,
      error: '멤버 정보를 불러오지 못했습니다.',
    } as const;
  }

  if (!membershipResult.data) {
    return {
      ok: false,
      status: 404,
      error: '멤버 정보를 찾을 수 없습니다.',
    } as const;
  }

  return {
    ok: true,
    membership: membershipResult.data as MembershipRow,
  } as const;
}

export async function getStigmasByIds(userIds: string[]) {
  if (userIds.length === 0) {
    return {
      ok: true,
      stigmas: [] as StigmaRow[],
    } as const;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const stigmaResult = await supabaseAdmin.from('stigmas').select('id, email, avatar').in('id', userIds);

  if (stigmaResult.error) {
    return {
      ok: false,
      error: '사용자 정보를 불러오지 못했습니다.',
    } as const;
  }

  return {
    ok: true,
    stigmas: (stigmaResult.data ?? []) as StigmaRow[],
  } as const;
}

export async function getLevelsByIds(siteId: string, levelIds: string[]) {
  if (levelIds.length === 0) {
    return {
      ok: true,
      levels: [] as LevelRow[],
    } as const;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const levelResult = await supabaseAdmin
    .from('community_levels')
    .select('id, lv, name, icon')
    .eq('site_id', siteId)
    .in('id', levelIds);

  if (levelResult.error) {
    return {
      ok: false,
      error: '등급 정보를 불러오지 못했습니다.',
    } as const;
  }

  return {
    ok: true,
    levels: (levelResult.data ?? []) as LevelRow[],
  } as const;
}

export function buildMemberResponse(
  membership: MembershipRow,
  stigmaMap: Map<string, StigmaRow>,
  levelMap: Map<string, LevelRow>,
) {
  const stigma = stigmaMap.get(membership.user_id) ?? null;
  const level = membership.lv ? (levelMap.get(membership.lv) ?? null) : null;

  return {
    email: decryptNullable(stigma?.email ?? null),
    avatar: stigma?.avatar ?? null,
    membership,
    level: level
      ? {
          id: level.id,
          lv: level.lv,
          name: normalizeText(level.name) || String(level.lv),
          icon: level.icon ?? null,
          iconUrl: level.icon ? getLevelIconUrl(level.icon) : '',
        }
      : null,
  };
}
