import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
  }>;
};

type RequestBody = {
  siteName: string | null;
  boardKey?: string | null;
  boardLabel?: string | null;
  boardType?: string | null;
  isActive?: boolean | null;
  markdownStatus?: string | null;
};

function normalizeBoardKey(rawValue: string | null | undefined) {
  return (rawValue ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
}

function hasInvalidBoardKeyCharacters(value: string) {
  return /[^a-z0-9-]/.test(value);
}

function isAllowedBoardType(value: string) {
  return value === 'board' || value === 'blog' || value === 'page' || value === 'community';
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
    const boardKey = normalizeBoardKey(requestBody.boardKey);
    const boardLabel = normalizeText(requestBody.boardLabel);
    const boardType = normalizeText(requestBody.boardType).toLowerCase();
    const markdownStatus = normalizeText(requestBody.markdownStatus) || 'markdown_default';
    const isActive = requestBody.isActive === null ? true : Boolean(requestBody.isActive);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!boardKey) {
      return Response.json({ error: '게시판 식별자를 입력해주세요.' }, { status: 400 });
    }

    if (hasInvalidBoardKeyCharacters(boardKey)) {
      return Response.json(
        {
          error: "영소문자, 하이픈('-'), 숫자만 사용 가능합니다.",
        },
        { status: 400 },
      );
    }

    if (/^\d/.test(boardKey)) {
      return Response.json({ error: '게시판 식별자는 숫자로 시작할 수 없습니다.' }, { status: 400 });
    }

    if (boardKey.length < 5 || boardKey.length > 15) {
      return Response.json({ error: '게시판 식별자는 5자 이상 15자 이하여야 합니다.' }, { status: 400 });
    }

    if (!boardLabel) {
      return Response.json({ error: '게시판 이름을 입력해주세요.' }, { status: 400 });
    }

    if (!isAllowedBoardType(boardType)) {
      return Response.json({ error: '게시판 종류가 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (session.status === 'FAIL' || session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const currentBoard = await supabaseAdmin
      .from('boards')
      .select('id, board_key')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (currentBoard.error) {
      return Response.json({ error: '게시판 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!currentBoard.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (boardKey !== normalizedBoardName) {
      const duplicateBoard = await supabaseAdmin
        .from('boards')
        .select('id')
        .eq('site_id', rhizome.data.id)
        .eq('board_key', boardKey)
        .maybeSingle();

      if (duplicateBoard.error) {
        return Response.json({ error: '게시판 식별자 확인에 실패했습니다.' }, { status: 500 });
      }

      if (duplicateBoard.data) {
        return Response.json({ error: '이미 존재하는 게시판 식별자입니다.' }, { status: 400 });
      }
    }

    const updateBoard = await supabaseAdmin
      .from('boards')
      .update({
        board_key: boardKey,
        board_label: boardLabel,
        board_type: boardType === 'community' ? 'board' : boardType,
        is_active: isActive,
        markdown_status: markdownStatus,
      })
      .eq('id', currentBoard.data.id)
      .select('id, board_key')
      .maybeSingle();

    if (updateBoard.error || !updateBoard.data) {
      return Response.json({ error: '게시판 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      boardId: updateBoard.data.id,
      boardName: updateBoard.data.board_key,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시판 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시판 수정에 실패했습니다.' }, { status: 500 });
  }
}
