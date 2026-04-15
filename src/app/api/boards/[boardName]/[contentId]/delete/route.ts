import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type RouteContext = {
  params: Promise<{
    boardName: string;
    contentId: string;
  }>;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { boardName, contentId } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const normalizedContentId = normalizeText(contentId);

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!normalizedContentId) {
      return Response.json({ error: 'contentId가 유효하지 않습니다.' }, { status: 400 });
    }

    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
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
      return Response.json({ error: '페이지 삭제는 이 경로에서 처리할 수 없습니다.' }, { status: 400 });
    }

    const post = await supabaseAdmin
      .from('posts')
      .select('id, user_id, thumbnail_image')
      .eq('board_id', board.data.id)
      .eq('slug', normalizedContentId)
      .maybeSingle();

    if (post.error || !post.data) {
      return Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (post.data.user_id !== sessionClaims.userId) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const deleteResult = await supabaseAdmin.from('posts').delete().eq('id', post.data.id);

    if (deleteResult.error) {
      return Response.json({ error: '글 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '글 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '글 삭제에 실패했습니다.' }, { status: 500 });
  }
}
