import { buildCommunityManagerList, getBoardSummaries, getCommunityManagerAccess } from '@/lib/community-manager/utils';
import { normalizeText } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    const access = await getCommunityManagerAccess(siteName);
    const managers = await buildCommunityManagerList(access);
    const boards = await getBoardSummaries(access);

    return Response.json({
      ok: true,
      permissions: access.actor.permissions,
      limits: {
        community_manager: access.planFeature.communityManagerLimit,
        board_manager: access.planFeature.boardManagerLimit,
        board_general_manager: access.planFeature.boardGeneralManagerLimit,
        board_assistant_manager: access.planFeature.boardAssistantManagerLimit,
      },
      managers,
      boards,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      const errorMessage = unknownError.message || '매니저 정보를 불러오지 못했습니다.';
      const status =
        errorMessage === 'siteName이 유효하지 않습니다.'
          ? 400
          : errorMessage === '사이트를 찾을 수 없습니다.'
            ? 404
            : errorMessage === '접근 권한이 없습니다.'
              ? 403
              : 500;

      return Response.json({ error: errorMessage }, { status });
    }

    return Response.json({ error: '매니저 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
