import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';

type RouteContext = {
  params: Promise<{
    boardName: string;
  }>;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { boardName } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (session.status === 'FAIL') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_type')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (board.data.board_type === 'page') {
      const deletePages = await supabaseAdmin.from('pages').delete().eq('board_id', board.data.id);

      if (deletePages.error) {
        return Response.json({ error: '페이지 삭제에 실패했습니다.' }, { status: 500 });
      }
    }

    const deleteBoard = await supabaseAdmin.from('boards').delete().eq('id', board.data.id);

    if (deleteBoard.error) {
      return Response.json({ error: '게시판 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시판 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시판 삭제에 실패했습니다.' }, { status: 500 });
  }
}
