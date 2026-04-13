import verifySession from '@/lib/session/verifySession';
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

    if (session.case !== 'staff' && session.case !== 'member') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (!session.authUserId) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (!session.rhizomeStigmaId) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const rhizomeStigma = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('is_approval, is_block')
      .eq('id', session.rhizomeStigmaId)
      .maybeSingle();

    if (rhizomeStigma.error || !rhizomeStigma.data) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (session.case === 'member') {
      if (rhizomeStigma.data.is_approval !== true || rhizomeStigma.data.is_block !== false) {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    if (session.case === 'staff') {
      if (rhizomeStigma.data.is_block === true) {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
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
      const page = await supabaseAdmin
        .from('pages')
        .select('id, user_id')
        .eq('board_id', board.data.id)
        .eq('slug', normalizedContentId)
        .maybeSingle();

      if (page.error || !page.data) {
        return Response.json({ error: '페이지를 찾을 수 없습니다.' }, { status: 404 });
      }

      if (page.data.user_id !== session.authUserId) {
        return Response.json({ error: '작성자만 삭제할 수 있습니다.' }, { status: 403 });
      }

      const deletePage = await supabaseAdmin.from('pages').delete().eq('id', page.data.id);

      if (deletePage.error) {
        return Response.json({ error: '페이지 삭제에 실패했습니다.' }, { status: 500 });
      }

      return Response.json({
        ok: true,
      });
    }

    if (board.data.board_type === 'blog') {
      const post = await supabaseAdmin
        .from('posts')
        .select('id, user_id')
        .eq('board_id', board.data.id)
        .eq('slug', normalizedContentId)
        .maybeSingle();

      if (post.error || !post.data) {
        return Response.json({ error: '블로그 글을 찾을 수 없습니다.' }, { status: 404 });
      }

      if (post.data.user_id !== session.authUserId) {
        return Response.json({ error: '작성자만 삭제할 수 있습니다.' }, { status: 403 });
      }

      const deletePost = await supabaseAdmin.from('posts').delete().eq('id', post.data.id);

      if (deletePost.error) {
        return Response.json({ error: '블로그 글 삭제에 실패했습니다.' }, { status: 500 });
      }

      return Response.json({
        ok: true,
      });
    }

    return Response.json({ error: '지원하지 않는 게시판 종류입니다.' }, { status: 400 });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '콘텐츠 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '콘텐츠 삭제에 실패했습니다.' }, { status: 500 });
  }
}
