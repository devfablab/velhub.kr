import { getSessionClaims } from '@/lib/session';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';

type RouteContext = {
  params: Promise<{
    boardName: string;
    contentId: string;
  }>;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export async function GET(request: Request, context: RouteContext) {
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
    const sessionClaims = await getSessionClaims();

    const rhizome = await supabaseAdmin
      .from('rhizomes')
      .select('id, visibility_type, is_shutdown')
      .eq('site_key', siteName)
      .maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    const isStaff = session.status !== 'FAIL' && session.case === 'staff';
    const isPublicReadable = rhizome.data.visibility_type === 'public' && rhizome.data.is_shutdown === false;

    if (!isPublicReadable && !isStaff) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, site_id')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (board.data.board_type === 'page') {
      const page = await supabaseAdmin
        .from('pages')
        .select(
          'id, slug, subject, summary, content_html, content_markdown, edited_at, created_at, sort_order, user_id, site_id, board_id',
        )
        .eq('board_id', board.data.id)
        .eq('slug', normalizedContentId)
        .maybeSingle();

      if (page.error || !page.data) {
        return Response.json({ error: '페이지를 찾을 수 없습니다.' }, { status: 404 });
      }

      let authorName = '';

      if (page.data.user_id) {
        const stigma = await supabaseAdmin
          .from('stigmas')
          .select('user_name')
          .eq('user_id', page.data.user_id)
          .maybeSingle();

        if (!stigma.error && stigma.data?.user_name) {
          authorName = decrypt(stigma.data.user_name);
        }
      }

      return Response.json({
        content: {
          ...page.data,
          slug: String(page.data.slug),
          idx: page.data.sort_order,
          author_name: authorName,
        },
        isAuthor: Boolean(sessionClaims?.userId && page.data.user_id === sessionClaims.userId),
        isStaff,
      });
    }

    const post = await supabaseAdmin
      .from('posts')
      .select(
        'id, slug, subject, summary, content_html, content_markdown, edited_at, created_at, idx, user_id, site_id, board_id, thumbnail_image, thumbnail_width, thumbnail_height, is_closed',
      )
      .eq('board_id', board.data.id)
      .eq('slug', normalizedContentId)
      .maybeSingle();

    if (post.error || !post.data) {
      return Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const isAuthor = Boolean(sessionClaims?.userId && post.data.user_id === sessionClaims.userId);

    if (post.data.is_closed === true && !isStaff) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    let authorName = '';

    if (post.data.user_id) {
      const nickname = await supabaseAdmin
        .from('rhizome_stigmas')
        .select('nickname')
        .eq('site_id', rhizome.data.id)
        .eq('user_id', post.data.user_id)
        .maybeSingle();

      if (!nickname.error && nickname.data?.nickname) {
        authorName = nickname.data.nickname;
      }

      if (!authorName) {
        const stigma = await supabaseAdmin
          .from('stigmas')
          .select('user_name')
          .eq('user_id', post.data.user_id)
          .maybeSingle();

        if (!stigma.error && stigma.data?.user_name) {
          authorName = decrypt(stigma.data.user_name);
        }
      }
    }

    return Response.json({
      content: {
        ...post.data,
        slug: String(post.data.slug),
        author_name: authorName,
      },
      isAuthor,
      isStaff,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '글을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '글을 불러오지 못했습니다.' }, { status: 500 });
  }
}
