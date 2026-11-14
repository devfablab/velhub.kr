import { getSupabaseAdmin } from '@/lib/clients/supabase';
import {
  type CommunityManageRoleType,
  isCommunityManageRole,
} from '@/lib/service/community/communityManager/permissions';
import { getRhizomeStigma, getSiteByName } from '@/lib/session/utils';
import { normalizeText } from '@/lib/utils';

type CommunityManageRoleRow = {
  role: string | null;
  board_id: string | null;
};

export type SiteMemberBody = {
  ok: boolean;
  status?: number;
  error?: string;
  allow?: boolean;
  redirectTo?: string | null;
  siteId?: string;
  stigmaId?: string;
  role?: string | null;
  siteType?: string | null;
  communityRoles?: CommunityManageRoleType[];
  managedBoardKeys?: string[];
  isRejoin?: boolean;
};

export type SiteMemberState = {
  status: number;
  body: SiteMemberBody;
};

function deny(status: number, error: string, extra: Partial<SiteMemberBody> = {}): SiteMemberState {
  return { status, body: { ok: false, status, error, ...extra } };
}

export async function getStigmaByUserId(userId: string | null | undefined) {
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    return null;
  }

  const stigmaResult = await getSupabaseAdmin()
    .from('stigmas')
    .select('id, role')
    .eq('user_id', normalizedUserId)
    .maybeSingle();

  if (stigmaResult.error || !stigmaResult.data) {
    return null;
  }

  return {
    userId: normalizedUserId,
    stigmaId: stigmaResult.data.id as string,
    role: stigmaResult.data.role as string | null,
  };
}

export async function getSiteMemberState(
  rawSiteName: string,
  currentStigma: { stigmaId: string; role: string | null } | null,
): Promise<SiteMemberState> {
  const siteName = normalizeText(rawSiteName).toLowerCase();

  if (!siteName) {
    return deny(400, 'siteName이 유효하지 않습니다.');
  }

  if (!currentStigma) {
    return deny(401, '로그인이 필요합니다.');
  }

  if (currentStigma.role === 'admin') {
    return {
      status: 200,
      body: {
        ok: true,
        allow: true,
        redirectTo: null,
        stigmaId: currentStigma.stigmaId,
        role: currentStigma.role,
        siteType: null,
        communityRoles: [],
      },
    };
  }

  const site = await getSiteByName(siteName);

  if (!site) {
    return deny(404, '사이트 정보를 불러오지 못했습니다.');
  }

  const rhizomeStigma = await getRhizomeStigma(site.id, currentStigma.stigmaId);

  if (!rhizomeStigma) {
    return deny(403, '접근 권한이 없습니다.');
  }

  if (rhizomeStigma.isBlock) {
    return deny(403, '활동이 정지된 사용자입니다.', { redirectTo: `/${siteName}/block` });
  }

  if (rhizomeStigma.isRejoin) {
    return deny(403, '재가입이 필요합니다.', { isRejoin: true });
  }

  if (site.siteType === 'community' && rhizomeStigma.isBanned) {
    return deny(403, '가입할 수 없는 사용자입니다.', { redirectTo: `/${siteName}/ban` });
  }

  if (site.siteType === 'community' && rhizomeStigma.isKicked) {
    return deny(403, '강제 탈퇴된 사용자입니다.', { redirectTo: `/${siteName}/kick` });
  }

  if (!rhizomeStigma.isApproval) {
    return deny(403, '접근 권한이 없습니다.');
  }

  if (site.siteType === 'blog' && rhizomeStigma.role === 'observer') {
    return deny(403, '옵저버는 블로그 팀원 권한이 없습니다.');
  }

  if (site.siteType !== 'community') {
    return {
      status: 200,
      body: {
        ok: true,
        allow: true,
        redirectTo: null,
        siteId: site.id,
        stigmaId: currentStigma.stigmaId,
        role: rhizomeStigma.role,
        siteType: site.siteType,
        communityRoles: [],
      },
    };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const communityResult = await supabaseAdmin.from('communities').select('id').eq('site_id', site.id).maybeSingle();

  if (communityResult.error || !communityResult.data) {
    return deny(404, '커뮤니티 정보를 불러오지 못했습니다.');
  }

  const manageRoleResult = await supabaseAdmin
    .from('community_manage_role')
    .select('role, board_id')
    .eq('community_id', communityResult.data.id)
    .eq('manager_id', rhizomeStigma.id);

  if (manageRoleResult.error) {
    return deny(500, '커뮤니티 권한을 불러오지 못했습니다.');
  }

  const manageRoleRows = (manageRoleResult.data ?? []) as CommunityManageRoleRow[];
  const manageRoles = manageRoleRows.map((item) => normalizeText(item.role)).filter(isCommunityManageRole);
  const communityRoles: CommunityManageRoleType[] = [
    ...(rhizomeStigma.role === 'owner' ? (['owner'] as CommunityManageRoleType[]) : []),
    ...manageRoles,
  ];
  const managedBoardIds = [
    ...new Set(
      manageRoleRows
        .filter((item) => {
          const role = normalizeText(item.role);

          return role === 'board-general-manager' || role === 'board-assistant-manager';
        })
        .map((item) => normalizeText(item.board_id))
        .filter(Boolean),
    ),
  ];
  const managedBoardResult =
    managedBoardIds.length > 0
      ? await supabaseAdmin.from('boards').select('board_key').eq('site_id', site.id).in('id', managedBoardIds)
      : { data: [], error: null };

  if (managedBoardResult.error) {
    return deny(500, '담당 게시판 권한을 불러오지 못했습니다.');
  }

  return {
    status: 200,
    body: {
      ok: true,
      allow: true,
      redirectTo: null,
      siteId: site.id,
      stigmaId: currentStigma.stigmaId,
      role: rhizomeStigma.role,
      siteType: site.siteType,
      communityRoles: [...new Set(communityRoles)],
      managedBoardKeys: (managedBoardResult.data ?? []).map((item) => normalizeText(item.board_key)).filter(Boolean),
    },
  };
}

export async function getNeedsSocialSignUp(userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('is_agree_term, is_agree_child, is_agree_privacy')
    .eq('user_id', userId)
    .maybeSingle();

  if (stigmaResult.error) {
    throw new Error('회원가입 상태를 확인하지 못했습니다.');
  }

  const hasAgreed =
    stigmaResult.data?.is_agree_term === true &&
    stigmaResult.data?.is_agree_child === true &&
    stigmaResult.data?.is_agree_privacy === true;

  if (hasAgreed) {
    return false;
  }

  const [particleResult, authUserResult] = await Promise.all([
    supabaseAdmin.from('particles').select('social').eq('id', userId).maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(userId),
  ]);

  if (particleResult.error || authUserResult.error) {
    throw new Error('회원가입 상태를 확인하지 못했습니다.');
  }

  const authUser = authUserResult.data.user;
  const provider = String(authUser?.app_metadata?.provider ?? authUser?.user_metadata?.provider ?? '').toLowerCase();

  return particleResult.data?.social === true || (provider !== '' && provider !== 'email');
}
