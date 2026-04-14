import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';

type ApplyRequestBody = {
  siteName: string | null;
  orderedBoardIds?: string[] | null;
  boardId?: string | null;
  boardLabel?: string | null;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

async function checkAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizome = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

  if (rhizome.error || !rhizome.data) {
    return {
      ok: false,
      status: 404,
      error: '사이트를 찾을 수 없습니다.',
    } as const;
  }

  const session = await verifySession({
    siteId: rhizome.data.id,
  });

  if (session.status === 'FAIL') {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }

  if (session.case !== 'staff') {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }

  return {
    ok: true,
    status: 200,
    siteId: rhizome.data.id,
    supabaseAdmin,
  } as const;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await checkAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const boards = await access.supabaseAdmin
      .from('boards')
      .select('id, board_type, board_label, sort_order')
      .eq('site_id', access.siteId)
      .order('sort_order', { ascending: true });

    if (boards.error) {
      return Response.json({ error: '메뉴 설정을 불러오지 못했습니다.' }, { status: 500 });
    }

    const boardRows = boards.data ?? [];
    const pageBoardIds = boardRows.filter((board) => board.board_type === 'page').map((board) => board.id);

    const pageSubjectMap = new Map<string, string>();

    if (pageBoardIds.length > 0) {
      const pages = await access.supabaseAdmin
        .from('pages')
        .select('board_id, subject')
        .in('board_id', pageBoardIds)
        .order('sort_order', { ascending: true });

      if (pages.error) {
        return Response.json({ error: '메뉴 설정을 불러오지 못했습니다.' }, { status: 500 });
      }

      for (const page of pages.data ?? []) {
        if (!pageSubjectMap.has(page.board_id)) {
          pageSubjectMap.set(page.board_id, page.subject ?? '');
        }
      }
    }

    return Response.json({
      menus: boardRows.map((board) => ({
        id: board.id,
        board_type: board.board_type,
        board_label: board.board_label,
        display_label:
          board.board_type === 'blog'
            ? board.board_label
            : board.board_type === 'page'
              ? pageSubjectMap.get(board.id) || board.board_label
              : board.board_label,
        sort_order: board.sort_order,
        is_renameable: board.board_type === 'blog',
      })),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '메뉴 설정을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '메뉴 설정을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const requestBody = (await request.json()) as ApplyRequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const orderedBoardIds = Array.isArray(requestBody.orderedBoardIds) ? requestBody.orderedBoardIds : [];

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (orderedBoardIds.length === 0) {
      return Response.json({ error: '정렬할 게시판이 없습니다.' }, { status: 400 });
    }

    const access = await checkAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const boards = await access.supabaseAdmin.from('boards').select('id').eq('site_id', access.siteId);

    if (boards.error) {
      return Response.json({ error: '메뉴 설정 저장에 실패했습니다.' }, { status: 500 });
    }

    const validBoardIdSet = new Set((boards.data ?? []).map((board) => board.id));

    if (orderedBoardIds.some((boardId) => !validBoardIdSet.has(boardId))) {
      return Response.json({ error: '게시판 정보가 유효하지 않습니다.' }, { status: 400 });
    }

    for (let index = 0; index < orderedBoardIds.length; index += 1) {
      const boardId = orderedBoardIds[index];

      const updateBoardOrder = await access.supabaseAdmin
        .from('boards')
        .update({
          sort_order: index + 1,
        })
        .eq('id', boardId)
        .eq('site_id', access.siteId);

      if (updateBoardOrder.error) {
        return Response.json({ error: '메뉴 설정 저장에 실패했습니다.' }, { status: 500 });
      }
    }

    return Response.json({
      ok: true,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '메뉴 설정 저장에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '메뉴 설정 저장에 실패했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as ApplyRequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const boardId = normalizeText(requestBody.boardId);
    const boardLabel = normalizeText(requestBody.boardLabel);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!boardId) {
      return Response.json({ error: 'boardId가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!boardLabel) {
      return Response.json({ error: '게시판 이름을 입력해주세요.' }, { status: 400 });
    }

    const access = await checkAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const board = await access.supabaseAdmin
      .from('boards')
      .select('id, board_type')
      .eq('id', boardId)
      .eq('site_id', access.siteId)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (board.data.board_type !== 'blog') {
      return Response.json({ error: '블로그 게시판만 이름 변경이 가능합니다.' }, { status: 400 });
    }

    const updateBoardLabel = await access.supabaseAdmin
      .from('boards')
      .update({
        board_label: boardLabel,
      })
      .eq('id', boardId)
      .eq('site_id', access.siteId)
      .select('id, board_label')
      .maybeSingle();

    if (updateBoardLabel.error || !updateBoardLabel.data) {
      return Response.json({ error: '게시판 이름 변경에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      board: updateBoardLabel.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시판 이름 변경에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시판 이름 변경에 실패했습니다.' }, { status: 500 });
  }
}
