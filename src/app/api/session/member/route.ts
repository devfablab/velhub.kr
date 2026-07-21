import { isCommunityManageRole, type CommunityManageRoleType } from '@/lib/community/community-manager/permissions';
import { getCurrentStigma, getRhizomeStigma, getSiteByName } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type CommunityRow = {
  id: string;
};

type CommunityManageRoleRow = {
  role: string | null;
};

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json(
        {
          ok: false,
          status: 400,
          error: 'siteName이 유효하지 않습니다.',
        },
        { status: 400 },
      );
    }

    const currentStigma = await getCurrentStigma();

    if (!currentStigma) {
      return Response.json(
        {
          ok: false,
          status: 401,
          error: '로그인이 필요합니다.',
        },
        { status: 401 },
      );
    }

    if (currentStigma.role === 'admin') {
      return Response.json({
        ok: true,
        allow: true,
        redirectTo: null,
        stigmaId: currentStigma.stigmaId,
        role: currentStigma.role,
        siteType: null,
        communityRoles: [],
      });
    }

    const site = await getSiteByName(siteName);

    if (!site) {
      return Response.json(
        {
          ok: false,
          status: 404,
          error: '사이트 정보를 불러오지 못했습니다.',
        },
        { status: 404 },
      );
    }

    const rhizomeStigma = await getRhizomeStigma(site.id, currentStigma.stigmaId);

    if (!rhizomeStigma) {
      return Response.json(
        {
          ok: false,
          status: 403,
          error: '접근 권한이 없습니다.',
        },
        { status: 403 },
      );
    }

    if (rhizomeStigma.isBlock) {
      return Response.json(
        {
          ok: false,
          status: 403,
          error: '활동이 정지된 사용자입니다.',
          redirectTo: `/${siteName}/block`,
        },
        { status: 403 },
      );
    }

    if (rhizomeStigma.isRejoin) {
      return Response.json(
        {
          ok: false,
          status: 403,
          error: '재가입이 필요합니다.',
          isRejoin: true,
        },
        { status: 403 },
      );
    }

    if (site.siteType === 'community' && rhizomeStigma.isBanned) {
      return Response.json(
        {
          ok: false,
          status: 403,
          error: '가입할 수 없는 사용자입니다.',
          redirectTo: `/${siteName}/ban`,
        },
        { status: 403 },
      );
    }

    if (site.siteType === 'community' && rhizomeStigma.isKicked) {
      return Response.json(
        {
          ok: false,
          status: 403,
          error: '강제 탈퇴된 사용자입니다.',
          redirectTo: `/${siteName}/kick`,
        },
        { status: 403 },
      );
    }

    if (!rhizomeStigma.isApproval) {
      return Response.json(
        {
          ok: false,
          status: 403,
          error: '접근 권한이 없습니다.',
        },
        { status: 403 },
      );
    }

    if (site.siteType === 'blog' && rhizomeStigma.role === 'observer') {
      return Response.json(
        {
          ok: false,
          status: 403,
          error: '옵저버는 블로그 팀원 권한이 없습니다.',
        },
        { status: 403 },
      );
    }

    if (site.siteType !== 'community') {
      return Response.json({
        ok: true,
        allow: true,
        redirectTo: null,
        siteId: site.id,
        stigmaId: currentStigma.stigmaId,
        role: rhizomeStigma.role,
        siteType: site.siteType,
        communityRoles: [],
      });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const communityResult = await supabaseAdmin.from('communities').select('id').eq('site_id', site.id).maybeSingle();

    if (communityResult.error || !communityResult.data) {
      return Response.json(
        {
          ok: false,
          status: 404,
          error: '커뮤니티 정보를 불러오지 못했습니다.',
        },
        { status: 404 },
      );
    }

    const community = communityResult.data as CommunityRow;

    const manageRoleResult = await supabaseAdmin
      .from('community_manage_role')
      .select('role')
      .eq('community_id', community.id)
      .eq('manager_id', rhizomeStigma.id);

    if (manageRoleResult.error) {
      return Response.json(
        {
          ok: false,
          status: 500,
          error: '커뮤니티 권한을 불러오지 못했습니다.',
        },
        { status: 500 },
      );
    }

    const manageRoles = ((manageRoleResult.data ?? []) as CommunityManageRoleRow[])
      .map((item) => normalizeText(item.role))
      .filter(isCommunityManageRole);

    const communityRoles: CommunityManageRoleType[] = [
      ...(rhizomeStigma.role === 'owner' ? (['owner'] as CommunityManageRoleType[]) : []),
      ...manageRoles,
    ];

    return Response.json({
      ok: true,
      allow: true,
      redirectTo: null,
      siteId: site.id,
      stigmaId: currentStigma.stigmaId,
      role: rhizomeStigma.role,
      siteType: site.siteType,
      communityRoles: [...new Set(communityRoles)],
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        {
          ok: false,
          status: 500,
          error: unknownError.message || '권한 확인에 실패했습니다.',
        },
        { status: 500 },
      );
    }

    return Response.json(
      {
        ok: false,
        status: 500,
        error: '권한 확인에 실패했습니다.',
      },
      { status: 500 },
    );
  }
}
