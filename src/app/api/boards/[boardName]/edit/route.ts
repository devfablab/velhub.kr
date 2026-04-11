import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type RouteContext = {
  params: Promise<{
    boardName: string;
  }>;
};

type RequestBody = {
  siteName: string | null;
  boardKey: string | null;
  boardLabel: string | null;
  boardType: string | null;
  isActive: boolean | null;
  markdownStatus: string | null;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function normalizeKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { boardName } = await context.params;
    const currentBoardName = normalizeKey(boardName);

    if (!currentBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeKey(requestBody.siteName);
    const boardKey = normalizeKey(requestBody.boardKey);
    const boardLabel = normalizeText(requestBody.boardLabel);
    const boardType = normalizeKey(requestBody.boardType);
    const isActive = requestBody.isActive;
    const markdownStatus = normalizeKey(requestBody.markdownStatus);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!boardKey) {
      return Response.json({ error: '게시판 식별자를 입력해주세요.' }, { status: 400 });
    }

    if (!boardLabel) {
      return Response.json({ error: '게시판 이름을 입력해주세요.' }, { status: 400 });
    }

    if (!boardType) {
      return Response.json({ error: '게시판 종류를 입력해주세요.' }, { status: 400 });
    }

    if (typeof isActive !== 'boolean') {
      return Response.json({ error: '활성화 상태를 확인해주세요.' }, { status: 400 });
    }

    if (!markdownStatus) {
      return Response.json({ error: '마크다운 상태를 입력해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error || !stigmaResult.data) {
      return Response.json({ error: '사용자 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const rhizomeResult = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (rhizomeResult.error || !rhizomeResult.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const manageResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('role')
      .eq('site_id', rhizomeResult.data.id)
      .eq('user_id', stigmaResult.data.id)
      .in('role', ['owner', 'manager'])
      .maybeSingle();

    if (manageResult.error || !manageResult.data) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const currentBoardResult = await supabaseAdmin
      .from('boards')
      .select('id')
      .eq('site_id', rhizomeResult.data.id)
      .eq('board_key', currentBoardName)
      .maybeSingle();

    if (currentBoardResult.error || !currentBoardResult.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (boardKey !== currentBoardName) {
      const duplicateResult = await supabaseAdmin
        .from('boards')
        .select('id')
        .eq('site_id', rhizomeResult.data.id)
        .eq('board_key', boardKey)
        .neq('id', currentBoardResult.data.id)
        .maybeSingle();

      if (duplicateResult.error) {
        return Response.json({ error: '게시판 중복 확인에 실패했습니다.' }, { status: 500 });
      }

      if (duplicateResult.data) {
        return Response.json({ error: '이미 존재하는 게시판 식별자입니다.' }, { status: 400 });
      }
    }

    const updateResult = await supabaseAdmin
      .from('boards')
      .update({
        board_key: boardKey,
        board_label: boardLabel,
        board_type: boardType,
        is_active: isActive,
        markdown_status: markdownStatus,
      })
      .eq('id', currentBoardResult.data.id);

    if (updateResult.error) {
      return Response.json({ error: '게시판 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      boardName: boardKey,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시판 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시판 수정에 실패했습니다.' }, { status: 500 });
  }
}
