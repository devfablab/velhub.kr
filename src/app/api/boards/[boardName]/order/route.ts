import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';

type RouteContext = {
  params: Promise<{
    boardName: string;
  }>;
};

type RequestBody = {
  siteName: string | null;
  boards: {
    boardName: string | null;
    sortOrder: number | null;
  }[];
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function normalizeSortOrder(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.floor(value);
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { boardName } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const boards = Array.isArray(requestBody.boards) ? requestBody.boards : [];

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (boards.length === 0) {
      return Response.json({ error: '정렬할 게시판이 없습니다.' }, { status: 400 });
    }

    const normalizedBoards = boards.map((item) => ({
      boardName: normalizeText(item.boardName).toLowerCase(),
      sortOrder: normalizeSortOrder(item.sortOrder),
    }));

    if (normalizedBoards.some((item) => !item.boardName || item.sortOrder === null || item.sortOrder < 1)) {
      return Response.json({ error: '게시판 정렬값이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id, site_type').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (session.status === 'FAIL' || session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const boardList = await supabaseAdmin.from('boards').select('id, board_key').eq('site_id', rhizome.data.id);

    if (boardList.error) {
      return Response.json({ error: '게시판 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const boardKeySet = new Set((boardList.data ?? []).map((item) => item.board_key));

    if (normalizedBoards.some((item) => !boardKeySet.has(item.boardName))) {
      return Response.json({ error: '게시판 정보를 불러오지 못했습니다.' }, { status: 404 });
    }

    for (const board of normalizedBoards) {
      const updateBoard = await supabaseAdmin
        .from('boards')
        .update({
          sort_order: board.sortOrder,
        })
        .eq('site_id', rhizome.data.id)
        .eq('board_key', board.boardName);

      if (updateBoard.error) {
        return Response.json({ error: '게시판 정렬 저장에 실패했습니다.' }, { status: 500 });
      }
    }

    return Response.json({
      ok: true,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시판 정렬 저장에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시판 정렬 저장에 실패했습니다.' }, { status: 500 });
  }
}
