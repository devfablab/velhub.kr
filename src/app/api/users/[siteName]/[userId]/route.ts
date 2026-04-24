import { normalizeText } from '@/lib/utils';
import {
  buildMemberResponse,
  getLevelsByIds,
  getPublicActiveMembership,
  getPublicMembersAccess,
  getStigmasByIds,
} from '@/lib/users/utils';

type RouteContext = {
  params: Promise<{
    siteName: string;
    userId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { siteName: rawSiteName, userId: rawUserId } = await context.params;
    const siteName = normalizeText(rawSiteName).toLowerCase();
    const userId = normalizeText(rawUserId);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!userId) {
      return Response.json({ error: 'userId가 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getPublicMembersAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const membershipResult = await getPublicActiveMembership(access.site.id, userId);

    if (!membershipResult.ok) {
      return Response.json({ error: membershipResult.error }, { status: membershipResult.status });
    }

    const stigmaResult = await getStigmasByIds([membershipResult.membership.user_id]);

    if (!stigmaResult.ok) {
      return Response.json({ error: stigmaResult.error }, { status: 500 });
    }

    const levelIds = membershipResult.membership.lv ? [membershipResult.membership.lv] : [];
    const levelResult = await getLevelsByIds(access.site.id, levelIds);

    if (!levelResult.ok) {
      return Response.json({ error: levelResult.error }, { status: 500 });
    }

    const stigmaMap = new Map(stigmaResult.stigmas.map((stigma) => [stigma.id, stigma]));
    const levelMap = new Map(levelResult.levels.map((level) => [level.id, level]));

    return Response.json({
      ok: true,
      siteName: access.site.site_key,
      user: buildMemberResponse(membershipResult.membership, stigmaMap, levelMap),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '멤버 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '멤버 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
