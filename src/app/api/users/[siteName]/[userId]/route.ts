import { decrypt } from '@/lib/encryption/decrypt';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

type MembershipRow = {
  id: string;
  created_at: string;
  user_id: string;
  site_id: string;
  is_approval: boolean;
  is_block: boolean;
  block_reason: string | null;
  role: string | null;
  nickname: string | null;
  lv: string | null;
  checkin_count: number | null;
};

type StigmaRow = {
  id: string;
  user_id: string;
  user_name: string | null;
  avatar: string | null;
};

type ManagerRoleRow = {
  role: string | null;
  board_id: string | null;
};

type ManagerIconRow = {
  role: string;
  icon: string | null;
};

type LevelRow = {
  id: string;
  lv: number;
  name: string | null;
  icon: string | null;
};

type PatchRequestBody = {
  siteName: string | null;
  nickname: string | null;
};

const MANAGER_ROLE_PRIORITY = [
  'owner',
  'community-manager',
  'board-manager',
  'board-general-manager',
  'board-assistant-manager',
] as const;

type ManagerRole = (typeof MANAGER_ROLE_PRIORITY)[number];

function decryptNullable(value: string | null | undefined) {
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

function getAvatarUrl(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  if (normalizedValue.startsWith('http://') || normalizedValue.startsWith('https://')) {
    return normalizedValue;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from('avatar').getPublicUrl(normalizedValue);

  return publicUrl.data.publicUrl ?? '';
}

function getLevelIconUrl(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from('lv-icon').getPublicUrl(normalizedValue);

  return publicUrl.data.publicUrl ?? '';
}

function getManagerIconUrl(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from('manager_icon').getPublicUrl(normalizedValue);

  return publicUrl.data.publicUrl ?? '';
}

function isManagerRole(value: string): value is ManagerRole {
  return MANAGER_ROLE_PRIORITY.includes(value as ManagerRole);
}

function getManagerRoleLabel(role: string) {
  if (role === 'owner') {
    return '운영자';
  }

  if (role === 'community-manager') {
    return '커뮤니티 매니저';
  }

  if (role === 'board-manager') {
    return '전체 게시판 매니저';
  }

  if (role === 'board-general-manager') {
    return '개별 게시판 총괄 매니저';
  }

  if (role === 'board-assistant-manager') {
    return '개별 게시판 부 매니저';
  }

  return role;
}

function sortManagerRoles(roles: string[]) {
  return [...new Set(roles)]
    .filter(isManagerRole)
    .sort((a, b) => MANAGER_ROLE_PRIORITY.indexOf(a) - MANAGER_ROLE_PRIORITY.indexOf(b));
}

async function getPostCount(siteId: string, userId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const result = await supabaseAdmin
    .from('posts')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('site_id', siteId)
    .eq('user_id', userId);

  if (result.error) {
    return 0;
  }

  return result.count ?? 0;
}

async function getCommentCount(siteId: string, userId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const result = await supabaseAdmin
    .from('post_comments')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('site_id', siteId)
    .eq('user_id', userId);

  if (result.error) {
    return 0;
  }

  return result.count ?? 0;
}

async function getCommunityUserInfo(siteName: string) {
  const normalizedSiteName = normalizeText(siteName).toLowerCase();

  if (!normalizedSiteName) {
    return {
      ok: false,
      status: 400,
      error: 'siteName이 유효하지 않습니다.',
    } as const;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_type')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (siteResult.error || !siteResult.data) {
    return {
      ok: false,
      status: 404,
      error: '사이트를 찾을 수 없습니다.',
    } as const;
  }

  if (siteResult.data.site_type !== 'community') {
    return {
      ok: false,
      status: 400,
      error: '커뮤니티 정보를 불러올 수 없습니다.',
    } as const;
  }

  const session = await verifySession({
    siteId: siteResult.data.id,
  });

  if (!session.authUserId) {
    return {
      ok: true,
      status: 200,
      data: {
        status: 'guest',
      },
    } as const;
  }

  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('id, user_id, user_name, avatar')
    .eq('user_id', session.authUserId)
    .maybeSingle();

  if (stigmaResult.error || !stigmaResult.data) {
    return {
      ok: false,
      status: 500,
      error: '사용자 정보를 불러오지 못했습니다.',
    } as const;
  }

  const stigma = stigmaResult.data as StigmaRow;

  const membershipResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('id, created_at, user_id, site_id, is_approval, is_block, block_reason, role, nickname, lv, checkin_count')
    .eq('site_id', siteResult.data.id)
    .eq('user_id', stigma.id)
    .maybeSingle();

  if (membershipResult.error) {
    return {
      ok: false,
      status: 500,
      error: '멤버 정보를 불러오지 못했습니다.',
    } as const;
  }

  if (!membershipResult.data) {
    const authUserResult = await supabaseAdmin.auth.admin.getUserById(session.authUserId);

    if (authUserResult.error || !authUserResult.data.user?.email) {
      return {
        ok: false,
        status: 500,
        error: '사용자 이메일을 불러오지 못했습니다.',
      } as const;
    }

    const email = authUserResult.data.user.email.trim().toLowerCase();

    const nowIsoString = new Date().toISOString();

    const inviteResult = await supabaseAdmin
      .from('invite')
      .select('token, expires_at')
      .eq('site_id', siteResult.data.id)
      .eq('email', email)
      .eq('role', 'member')
      .eq('status', 'pending')
      .is('cancelled_at', null)
      .is('joined_at', null)
      .gt('expires_at', nowIsoString)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inviteResult.error) {
      return {
        ok: false,
        status: 500,
        error: '초대 정보를 불러오지 못했습니다.',
      } as const;
    }

    if (inviteResult.data) {
      return {
        ok: true,
        status: 200,
        data: {
          status: 'pending_invite',
          inviteHref: `/${siteResult.data.site_key}/invite-community/${inviteResult.data.token}`,
        },
      } as const;
    }

    const communityResult = await supabaseAdmin
      .from('communities')
      .select('join_type')
      .eq('site_id', siteResult.data.id)
      .maybeSingle();

    if (communityResult.error || !communityResult.data) {
      return {
        ok: false,
        status: 500,
        error: '커뮤니티 가입 설정을 불러오지 못했습니다.',
      } as const;
    }

    if (communityResult.data.join_type === 'invite') {
      return {
        ok: true,
        status: 200,
        data: {
          status: 'invite_only',
        },
      } as const;
    }

    return {
      ok: true,
      status: 200,
      data: {
        status: 'not_joined',
      },
    } as const;
  }

  const membership = membershipResult.data as MembershipRow;

  if (!membership.is_approval) {
    return {
      ok: true,
      status: 200,
      data: {
        status: 'pending_join',
      },
    } as const;
  }

  if (membership.is_block) {
    return {
      ok: true,
      status: 200,
      data: {
        status: 'blocked',
        blockReason: normalizeText(membership.block_reason) || '등록된 사유가 없습니다.',
      },
    } as const;
  }

  const communityResult = await supabaseAdmin
    .from('communities')
    .select('id')
    .eq('site_id', siteResult.data.id)
    .maybeSingle();

  if (communityResult.error || !communityResult.data) {
    return {
      ok: false,
      status: 500,
      error: '커뮤니티 정보를 불러오지 못했습니다.',
    } as const;
  }

  const manageRoleResult = await supabaseAdmin
    .from('community_manage_role')
    .select('role, board_id')
    .eq('community_id', communityResult.data.id)
    .eq('manager_id', membership.id);

  if (manageRoleResult.error) {
    return {
      ok: false,
      status: 500,
      error: '매니저 정보를 불러오지 못했습니다.',
    } as const;
  }

  const baseRole = normalizeText(membership.role);
  const manageRoles = (manageRoleResult.data ?? [])
    .map((row) => normalizeText((row as ManagerRoleRow).role))
    .filter(isManagerRole);

  const managerRoles = sortManagerRoles([...(baseRole === 'owner' ? ['owner'] : []), ...manageRoles]);
  const primaryManagerRole = managerRoles[0] ?? '';

  let managerIconUrl = '';

  if (primaryManagerRole) {
    const managerIconResult = await supabaseAdmin
      .from('community_manage_icons')
      .select('role, icon')
      .eq('site_id', siteResult.data.id)
      .eq('role', primaryManagerRole)
      .maybeSingle();

    if (!managerIconResult.error && managerIconResult.data) {
      managerIconUrl = getManagerIconUrl((managerIconResult.data as ManagerIconRow).icon);
    }
  }

  let level: {
    name: string;
    iconUrl: string;
  } | null = null;

  if (!primaryManagerRole && membership.lv) {
    const levelResult = await supabaseAdmin
      .from('community_levels')
      .select('id, lv, name, icon')
      .eq('site_id', siteResult.data.id)
      .eq('id', membership.lv)
      .maybeSingle();

    if (!levelResult.error && levelResult.data) {
      const levelRow = levelResult.data as LevelRow;

      level = {
        name: normalizeText(levelRow.name) || String(levelRow.lv),
        iconUrl: getLevelIconUrl(levelRow.icon),
      };
    }
  }

  const [postCount, commentCount] = await Promise.all([
    getPostCount(siteResult.data.id, session.authUserId),
    getCommentCount(siteResult.data.id, session.authUserId),
  ]);

  return {
    ok: true,
    status: 200,
    data: {
      status: 'active',
      userInfo: {
        avatarUrl: getAvatarUrl(stigma.avatar ?? null),
        activityName: decryptNullable(stigma.user_name),
        nickname: normalizeText(membership.nickname),
        joinedAt: membership.created_at,
        postCount,
        commentCount,
        checkinCount: Number(membership.checkin_count ?? 0),
        managerRoles: managerRoles.map((role) => ({
          role,
          label: getManagerRoleLabel(role),
        })),
        managerIconUrl,
        level,
      },
    },
  } as const;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { siteName: rawSiteName } = await context.params;
    const siteName = normalizeText(rawSiteName).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const result = await getCommunityUserInfo(siteName);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({
      ok: true,
      ...result.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '사용자 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '사용자 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const requestBody = (await request.json()) as PatchRequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const nickname = normalizeText(requestBody.nickname);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!nickname) {
      return Response.json({ error: '별명을 입력해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const siteResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_type')
      .eq('site_key', siteName)
      .maybeSingle();

    if (siteResult.error || !siteResult.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (siteResult.data.site_type !== 'community') {
      return Response.json({ error: '커뮤니티 정보를 불러올 수 없습니다.' }, { status: 400 });
    }

    const session = await verifySession({
      siteId: siteResult.data.id,
    });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id')
      .eq('user_id', session.authUserId)
      .maybeSingle();

    if (stigmaResult.error || !stigmaResult.data) {
      return Response.json({ error: '사용자 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const membershipResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('id, nickname, is_approval, is_block')
      .eq('site_id', siteResult.data.id)
      .eq('user_id', stigmaResult.data.id)
      .maybeSingle();

    if (membershipResult.error || !membershipResult.data) {
      return Response.json({ error: '멤버 정보를 불러오지 못했습니다.' }, { status: 404 });
    }

    if (!membershipResult.data.is_approval || membershipResult.data.is_block) {
      return Response.json({ error: '수정할 수 없습니다.' }, { status: 403 });
    }

    const currentNickname = normalizeText(membershipResult.data.nickname);

    if (nickname === currentNickname) {
      return Response.json({ error: '수정할 내용이 없습니다.' }, { status: 400 });
    }

    const duplicateNicknameResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('id')
      .eq('site_id', siteResult.data.id)
      .eq('nickname', nickname)
      .neq('id', membershipResult.data.id)
      .limit(1)
      .maybeSingle();

    if (duplicateNicknameResult.error) {
      return Response.json({ error: '별명을 확인하지 못했습니다.' }, { status: 500 });
    }

    if (duplicateNicknameResult.data) {
      return Response.json({ error: '이미 사용 중인 별명입니다.' }, { status: 400 });
    }

    const updateResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .update({
        nickname,
      })
      .eq('id', membershipResult.data.id);

    if (updateResult.error) {
      return Response.json({ error: '별명 수정에 실패했습니다.' }, { status: 500 });
    }

    const nextInfo = await getCommunityUserInfo(siteName);

    if (!nextInfo.ok) {
      return Response.json({ error: nextInfo.error }, { status: nextInfo.status });
    }

    return Response.json({
      ok: true,
      ...nextInfo.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '별명 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '별명 수정에 실패했습니다.' }, { status: 500 });
  }
}
