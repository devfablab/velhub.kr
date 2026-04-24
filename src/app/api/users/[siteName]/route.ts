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

    const stigmaMap = new Map(stigmaResult.stigmas.map((stigma) => [stigma.id, stigma]));
    const levelMap = new Map(levelResult.levels.map((level) => [level.id, level]));

    return Response.json({
      ok: true,
      siteName: access.site.site_key,
      users: membershipsResult.memberships.map((membership) => buildMemberResponse(membership, stigmaMap, levelMap)),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '멤버 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '멤버 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
