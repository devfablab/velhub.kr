import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
    contentId: string;
  }>;
};

function isNumericSlug(value: string) {
  return /^\d+$/.test(value);
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

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    const isStaff = session.status !== 'FAIL' && session.case === 'staff';

    if (rhizome.data.visibility_type !== 'public' || rhizome.data.is_shutdown !== false) {
      if (!isStaff) {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, markdown_status, site_id')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (board.data.board_type === 'page') {
      const pageQuery = supabaseAdmin
        .from('pages')
        .select(
          'id, slug, subject, summary, content_html, content_markdown, edited_at, sort_order, user_id, site_id, board_id, created_at, og_image, og_image_url, attachment_slug, attachment_origin, is_comment',
        )
        .eq('board_id', board.data.id);

      const page = isNumericSlug(normalizedContentId)
        ? await pageQuery.eq('slug', Number(normalizedContentId)).maybeSingle()
        : await pageQuery.eq('id', normalizedContentId).maybeSingle();

      if (page.error || !page.data) {
        return Response.json({ error: '페이지를 찾을 수 없습니다.' }, { status: 404 });
      }

      let authorName = '';

      if (page.data.user_id) {
        const nicknameResult = await supabaseAdmin
          .from('rhizome_stigmas')
          .select('nickname')
          .eq('site_id', rhizome.data.id)
          .eq('user_id', page.data.user_id)
          .maybeSingle();

        if (!nicknameResult.error && nicknameResult.data?.nickname) {
          authorName = nicknameResult.data.nickname as string;
        } else {
          const stigmaResult = await supabaseAdmin
            .from('stigmas')
            .select('user_name')
            .eq('user_id', page.data.user_id)
            .maybeSingle();

          if (!stigmaResult.error && stigmaResult.data?.user_name) {
            authorName = decrypt(stigmaResult.data.user_name as string);
          }
        }
      }

      return Response.json({
        board: board.data,
        content: {
          ...page.data,
          slug: String(page.data.slug),
          author_name: authorName,
        },
        isAuthor: session.status !== 'FAIL' ? page.data.user_id === session.particleId : false,
        isStaff,
      });
    }

    const postQuery = supabaseAdmin
      .from('posts')
      .select(
        'id, slug, subject, summary, content_html, content_markdown, edited_at, thumbnail_image, thumbnail_width, thumbnail_height, idx, user_id, site_id, board_id, created_at, is_closed, categories, series_id',
      )
      .eq('board_id', board.data.id);

    const post = isNumericSlug(normalizedContentId)
      ? await postQuery.eq('slug', Number(normalizedContentId)).maybeSingle()
      : await postQuery.eq('id', normalizedContentId).maybeSingle();

    if (post.error || !post.data) {
      return Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (post.data.is_closed === true && !isStaff) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    let authorName = '';

    if (post.data.user_id) {
      const nicknameResult = await supabaseAdmin
        .from('rhizome_stigmas')
        .select('nickname')
        .eq('site_id', rhizome.data.id)
        .eq('user_id', post.data.user_id)
        .maybeSingle();

      if (!nicknameResult.error && nicknameResult.data?.nickname) {
        authorName = nicknameResult.data.nickname as string;
      } else {
        const stigmaResult = await supabaseAdmin
          .from('stigmas')
          .select('user_name')
          .eq('user_id', post.data.user_id)
          .maybeSingle();

        if (!stigmaResult.error && stigmaResult.data?.user_name) {
          authorName = decrypt(stigmaResult.data.user_name as string);
        }
      }
    }

    const categoryIds = Array.isArray(post.data.categories)
      ? post.data.categories.filter((value: unknown): value is string => typeof value === 'string' && Boolean(value))
      : [];

    let categories: Array<{
      id: string;
      category_key: string;
      category_label: string;
      summary: string | null;
      thumbnail_image: string | null;
      sort_order: number;
      board_id: string;
      site_id: string;
      created_at?: string;
    }> = [];

    if (categoryIds.length > 0) {
      const categoryResult = await supabaseAdmin
        .from('board_categories')
        .select('id, category_key, category_label, summary, thumbnail_image, sort_order, board_id, site_id, created_at')
        .eq('site_id', rhizome.data.id)
        .eq('board_id', board.data.id)
        .in('id', categoryIds)
        .order('sort_order', { ascending: true });

      if (categoryResult.error) {
        return Response.json({ error: '카테고리 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      categories = categoryResult.data ?? [];
    }

    let series: {
      id: string;
      created_at: string;
      series_key: string;
      series_label: string;
      summary: string | null;
      thumbnail_image: string | null;
      board_id: string;
      site_id: string;
      last_published_at: string | null;
      is_completed: boolean;
      user_id: string | null;
    } | null = null;

    if (post.data.series_id) {
      const seriesResult = await supabaseAdmin
        .from('board_series')
        .select(
          'id, created_at, series_key, series_label, summary, thumbnail_image, board_id, site_id, last_published_at, is_completed, user_id',
        )
        .eq('site_id', rhizome.data.id)
        .eq('board_id', board.data.id)
        .eq('id', post.data.series_id)
        .maybeSingle();

      if (seriesResult.error) {
        return Response.json({ error: '시리즈 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      series = seriesResult.data ?? null;
    }

    return Response.json({
      board: board.data,
      content: {
        ...post.data,
        slug: String(post.data.slug),
        author_name: authorName,
      },
      categories,
      series,
      isAuthor: session.status !== 'FAIL' ? post.data.user_id === session.particleId : false,
      isStaff,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시글 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시글 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
