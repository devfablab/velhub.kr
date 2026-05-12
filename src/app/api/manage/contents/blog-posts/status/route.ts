import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type CommentProvider = 'none' | 'giscus' | 'disqus' | 'velhub';

function isCommentProvider(value: string): value is CommentProvider {
  return value === 'none' || value === 'giscus' || value === 'disqus' || value === 'velhub';
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id, site_type').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (session.case === 'guest-site' || session.case === 'guest-public') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (rhizome.data.site_type === 'blog') {
      if (session.case !== 'staff' && session.case !== 'member') {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }

      const [board, blog] = await Promise.all([
        supabaseAdmin
          .from('boards')
          .select('id, board_key')
          .eq('site_id', rhizome.data.id)
          .eq('board_key', 'b')
          .eq('board_type', 'blog')
          .maybeSingle(),
        supabaseAdmin.from('blogs').select('comment_provider').eq('site_id', rhizome.data.id).maybeSingle(),
      ]);

      if (board.error) {
        return Response.json({ error: '블로그 게시판 상태를 불러오지 못했습니다.' }, { status: 500 });
      }

      if (blog.error || !blog.data || !isCommentProvider(blog.data.comment_provider)) {
        return Response.json({ error: '블로그 댓글 설정을 불러오지 못했습니다.' }, { status: 500 });
      }

      return Response.json({
        hasBoard: Boolean(board.data),
        boardName: board.data?.board_key ?? null,
        boardId: board.data?.id ?? null,
        siteId: rhizome.data.id,
        commentProvider: blog.data.comment_provider,
      });
    }

    if (session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_key')
      .eq('site_id', rhizome.data.id)
      .in('board_key', ['b', 'p'])
      .maybeSingle();

    if (board.error) {
      return Response.json({ error: '게시판 상태를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      hasBoard: Boolean(board.data),
      boardName: board.data?.board_key ?? null,
      boardId: board.data?.id ?? null,
      siteId: rhizome.data.id,
      commentProvider: null,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시판 상태를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시판 상태를 불러오지 못했습니다.' }, { status: 500 });
  }
}
