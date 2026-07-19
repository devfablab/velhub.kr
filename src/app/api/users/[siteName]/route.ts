import { normalizeText } from '@/lib/utils';
import {
  buildMemberResponse,
  getLevelsByIds,
  getPublicActiveMemberships,
  getPublicMembersAccess,
  getStigmasByIds,
} from '@/lib/users/utils';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

type ManageRoleRow = {
  manager_id: string;
  role: string | null;
};

function getManageRoleLabel(role: string | null | undefined) {
  const normalizedRole = normalizeText(role);

  if (normalizedRole === 'community-manager') {
    return '커뮤니티 매니저';
  }

  if (normalizedRole === 'board-manager') {
    return '전체 게시판 매니저';
  }

  if (normalizedRole === 'board-general-manager') {
    return '개별 게시판 총괄 매니저';
  }

  if (normalizedRole === 'board-assistant-manager') {
    return '개별 게시판 부 매니저';
  }

  return '매니저';
}

function getMembershipRoleLabel(role: string | null | undefined, manageRole: string | null | undefined) {
  const normalizedRole = normalizeText(role);

  if (normalizedRole === 'owner') {
    return '운영자';
  }

  if (normalizedRole === 'manager') {
    return getManageRoleLabel(manageRole);
  }

  return '멤버';
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { siteName: rawSiteName } = await context.params;
    const siteName = normalizeText(rawSiteName).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getPublicMembersAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const membershipsResult = await getPublicActiveMemberships(access.site.id);

    if (!membershipsResult.ok) {
      return Response.json({ error: membershipsResult.error }, { status: 500 });
    }

    const userIds = [...new Set(membershipsResult.memberships.map((membership) => membership.user_id))];
    const membershipIds = [...new Set(membershipsResult.memberships.map((membership) => membership.id))];
    const levelIds = [
      ...new Set(membershipsResult.memberships.map((membership) => membership.lv).filter(Boolean) as string[]),
    ];

    const stigmaResult = await getStigmasByIds(userIds);

    if (!stigmaResult.ok) {
      return Response.json({ error: stigmaResult.error }, { status: 500 });
    }

    const levelResult = await getLevelsByIds(access.site.id, levelIds);

    if (!levelResult.ok) {
      return Response.json({ error: levelResult.error }, { status: 500 });
    }

    const communityResult = await access.supabaseAdmin
      .from('communities')
      .select('id')
      .eq('site_id', access.site.id)
      .maybeSingle();

    if (communityResult.error || !communityResult.data) {
      return Response.json({ error: '커뮤니티 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const manageRoleResult =
      membershipIds.length > 0
        ? await access.supabaseAdmin
            .from('community_manage_role')
            .select('manager_id, role')
            .eq('community_id', communityResult.data.id)
            .in('manager_id', membershipIds)
        : { data: [], error: null };

    if (manageRoleResult.error) {
      return Response.json({ error: '매니저 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const stigmaMap = new Map(stigmaResult.stigmas.map((stigma) => [stigma.id, stigma]));
    const levelMap = new Map(levelResult.levels.map((level) => [level.id, level]));
    const manageRoleMap = new Map(
      ((manageRoleResult.data ?? []) as ManageRoleRow[]).map((manageRole) => [manageRole.manager_id, manageRole.role]),
    );

    return Response.json({
      ok: true,
      siteName: access.site.site_key,
      users: membershipsResult.memberships.map((membership) => {
        const memberResponse = buildMemberResponse(membership, stigmaMap, levelMap);
        const normalizedMembershipRole = normalizeText(membership.role);
        const isManageMember =
          normalizedMembershipRole === 'owner' ||
          normalizedMembershipRole === 'manager' ||
          manageRoleMap.has(membership.id);

        return {
          ...memberResponse,
          membership: {
            ...memberResponse.membership,
            role: getMembershipRoleLabel(membership.role, manageRoleMap.get(membership.id) ?? null),
            is_selectable: !isManageMember,
          },
        };
      }),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '멤버 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '멤버 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
