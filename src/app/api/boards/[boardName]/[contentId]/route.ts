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

    const rhizome = await supabaseAdmin
      .from('rhizomes')
      .select('id, visibility_type, is_shutdown')
      .eq('site_key', siteName)
      .maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const isPublicReadable = rhizome.data.visibility_type === 'public' && rhizome.data.is_shutdown === false;

    if (!isPublicReadable) {
      const session = await verifySession({
        siteId: rhizome.data.id,
      });

      if (session.status === 'FAIL') {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }

      if (session.case !== 'staff') {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, is_active, sort_order, markdown_status, site_id')
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
          'id, slug, subject, summary, content_html, content_markdown, created_at, edited_at, og_image, attachment_slug, attachment_origin, sort_order, user_id, site_id, board_id, is_comment',
        )
        .eq('board_id', board.data.id)
        .eq('slug', normalizedContentId)
        .maybeSingle();

      if (page.error || !page.data) {
        return Response.json({ error: '페이지를 찾을 수 없습니다.' }, { status: 404 });
      }

      let authorName = '';

      const nickname = await supabaseAdmin
        .from('rhizome_stigmas')
        .select('nickname')
        .eq('site_id', rhizome.data.id)
        .eq('user_id', page.data.user_id)
        .maybeSingle();

      if (nickname.data?.nickname) {
        authorName = nickname.data.nickname;
      } else {
        const authorStigma = await supabaseAdmin
          .from('stigmas')
          .select('user_name')
          .eq('user_id', page.data.user_id)
          .maybeSingle();

        if (authorStigma.data?.user_name) {
          authorName = decrypt(authorStigma.data.user_name);
        }
      }

      let ogImageUrl = '';

      if (page.data.og_image) {
        if (page.data.og_image.startsWith('supabase:')) {
          const targetPath = page.data.og_image.replace('supabase:', '').trim();
          const publicUrl = supabaseAdmin.storage.from('og-image').getPublicUrl(targetPath);
          ogImageUrl = publicUrl.data.publicUrl ?? '';
        } else {
          ogImageUrl = page.data.og_image;
        }
      }

      return Response.json({
        board: board.data,
        content: {
          ...page.data,
          author_name: authorName,
          og_image_url: ogImageUrl,
        },
      });
    }

    if (board.data.board_type === 'blog') {
      const numericContentId = Number(normalizedContentId);

      const post = await supabaseAdmin
        .from('posts')
        .select(
          'id, user_id, slug, content_html, content_markdown, subject, summary, edited_at, thumbnail_image, thumbnail_width, thumbnail_height, idx, board_id, site_id, created_at',
        )
        .eq('board_id', board.data.id)
        .eq('slug', Number.isFinite(numericContentId) ? numericContentId : -1)
        .maybeSingle();

      if (post.error || !post.data) {
        return Response.json({ error: '블로그 글을 찾을 수 없습니다.' }, { status: 404 });
      }

      let authorName = '';

      const nickname = await supabaseAdmin
        .from('rhizome_stigmas')
        .select('nickname')
        .eq('site_id', rhizome.data.id)
        .eq('user_id', post.data.user_id)
        .maybeSingle();

      if (nickname.data?.nickname) {
        authorName = nickname.data.nickname;
      } else {
        const authorStigma = await supabaseAdmin
          .from('stigmas')
          .select('user_name')
          .eq('user_id', post.data.user_id)
          .maybeSingle();

        if (authorStigma.data?.user_name) {
          authorName = decrypt(authorStigma.data.user_name);
        }
      }

      let thumbnailImageUrl = '';

      if (post.data.thumbnail_image) {
        if (post.data.thumbnail_image.startsWith('supabase:')) {
          const targetPath = post.data.thumbnail_image.replace('supabase:', '').trim();
          const publicUrl = supabaseAdmin.storage.from('og-image').getPublicUrl(targetPath);
          thumbnailImageUrl = publicUrl.data.publicUrl ?? '';
        } else {
          thumbnailImageUrl = post.data.thumbnail_image;
        }
      }

      return Response.json({
        board: board.data,
        content: {
          ...post.data,
          slug: String(post.data.slug),
          author_name: authorName,
          thumbnail_image_url: thumbnailImageUrl,
        },
      });
    }

    return Response.json({ error: '지원하지 않는 게시판 종류입니다.' }, { status: 400 });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '콘텐츠 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '콘텐츠 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
