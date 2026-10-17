import { getSiteGuidelineManagementContext, isSiteGuidelineType, saveSiteGuideline } from '@/lib/siteGuidelines/server';
import { normalizeText } from '@/lib/utils';

type SaveRequestBody = {
  siteName?: string | null;
  type?: string | null;
  boardId?: string | null;
  items?: unknown;
};

function getErrorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : '';

  if (message === 'siteName이 유효하지 않습니다.' || message === '게시판이 유효하지 않습니다.') {
    return 400;
  }

  if (message === '사이트를 찾을 수 없습니다.' || message === '게시판을 찾을 수 없습니다.') {
    return 404;
  }

  if (message === '접근 권한이 없습니다.' || message === '수정 권한이 없습니다.') {
    return 403;
  }

  return 500;
}

export async function GET(request: Request) {
  try {
    const siteName = normalizeText(new URL(request.url).searchParams.get('siteName')).toLowerCase();
    const context = await getSiteGuidelineManagementContext(siteName);

    return Response.json({
      siteType: context.siteType,
      boards: context.boards,
      guidelines: context.guidelines,
      permissions: {
        common: context.getPermission('common'),
        ...(context.siteType === 'blog'
          ? {
              blogCommunity: context.getPermission('blog-community'),
              blogPost: context.getPermission('blog-post'),
            }
          : {
              boardCommon: context.getPermission('board-common'),
              boardSpecific: context.boards.map((board) => ({
                boardId: board.id,
                ...context.getPermission('board-specific', board.id),
              })),
            }),
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '가이드라인을 불러오지 못했습니다.' },
      { status: getErrorStatus(error) },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as SaveRequestBody;
    const siteName = normalizeText(body.siteName).toLowerCase();
    const type = normalizeText(body.type);

    if (!isSiteGuidelineType(type)) {
      return Response.json({ error: '가이드라인 유형이 유효하지 않습니다.' }, { status: 400 });
    }

    const guideline = await saveSiteGuideline({
      siteName,
      type,
      boardId: body.boardId,
      items: body.items,
    });

    return Response.json({ guideline });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '가이드라인을 저장하지 못했습니다.' },
      { status: getErrorStatus(error) },
    );
  }
}
