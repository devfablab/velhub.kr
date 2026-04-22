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
  subject?: string | null;
  summary?: string | null;
  contentHtml?: string | null;
  contentMarkdown?: string | null;
  thumbnailImage?: string | null;
  thumbnailWidth?: number | null;
  thumbnailHeight?: number | null;
  categories?: string[] | null;
  seriesKey?: string | null;
  prefixId?: string | null;
};

function isValidCategoryKey(value: string) {
  if (value.length < 2 || value.length > 16) {
    return false;
  }

  if (!/[a-z]/.test(value)) {
    return false;
  }

  if (/[^a-z0-9\-_]/.test(value)) {
    return false;
  }

  if (value.startsWith('_') || value.endsWith('_')) {
    return false;
  }

  if (value.includes('__')) {
    return false;
  }

  return true;
}

function isValidSeriesKey(value: string) {
  if (value.length < 5 || value.length > 16) {
    return false;
  }

  if (!/[a-z]/.test(value)) {
    return false;
  }

  if (/[^a-z0-9\-_]/.test(value)) {
    return false;
  }

  if (value.startsWith('_') || value.endsWith('_')) {
    return false;
  }

  if (value.includes('__')) {
    return false;
  }

  return true;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { boardName } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const subject = normalizeText(requestBody.subject);
    const summary = normalizeText(requestBody.summary);
    const contentHtml = normalizeText(requestBody.contentHtml);
    const contentMarkdown = normalizeText(requestBody.contentMarkdown);
    const thumbnailImage = normalizeText(requestBody.thumbnailImage);
    const seriesKey = normalizeText(requestBody.seriesKey).toLowerCase();
    const prefixId = normalizeText(requestBody.prefixId);
    const thumbnailWidth =
      typeof requestBody.thumbnailWidth === 'number' && Number.isFinite(requestBody.thumbnailWidth)
        ? Math.floor(requestBody.thumbnailWidth)
        : null;
    const thumbnailHeight =
      typeof requestBody.thumbnailHeight === 'number' && Number.isFinite(requestBody.thumbnailHeight)
        ? Math.floor(requestBody.thumbnailHeight)
        : null;

    const categoryKeys = Array.isArray(requestBody.categories)
      ? Array.from(
          new Set(
            requestBody.categories
              .map((value) => normalizeText(value).toLowerCase())
              .filter((value) => value && isValidCategoryKey(value)),
          ),
        )
      : [];

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!subject) {
      return Response.json({ error: '제목을 입력해주세요.' }, { status: 400 });
    }

    if (!contentHtml || !contentMarkdown) {
      return Response.json({ error: '내용을 입력해주세요.' }, { status: 400 });
    }

    if (seriesKey && !isValidSeriesKey(seriesKey)) {
      return Response.json({ error: '연재 식별자가 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_type, visibility_type, is_shutdown')
      .eq('site_key', siteName)
      .maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (session.status === 'FAIL' || (session.case !== 'staff' && session.case !== 'member')) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_type, site_id, post_type')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (board.data.board_type === 'page') {
      return Response.json({ error: '페이지 게시판에는 글을 작성할 수 없습니다.' }, { status: 403 });
    }

    let categoryIds: string[] = [];

    if (categoryKeys.length > 0) {
      const categoryResult = await supabaseAdmin
        .from('board_categories')
        .select('id, category_key')
        .eq('site_id', rhizome.data.id)
        .eq('board_id', board.data.id)
        .in('category_key', categoryKeys);

      if (categoryResult.error) {
        return Response.json({ error: '카테고리 정보를 확인하지 못했습니다.' }, { status: 500 });
      }

      if ((categoryResult.data ?? []).length !== categoryKeys.length) {
        return Response.json({ error: '일부 카테고리를 찾을 수 없습니다.' }, { status: 404 });
      }

      const categoryMap = new Map(
        (categoryResult.data ?? []).map((category) => [category.category_key as string, category.id as string]),
      );

      categoryIds = categoryKeys.map((categoryKey) => categoryMap.get(categoryKey) as string);
    }

    let seriesId: string | null = null;

    if (seriesKey) {
      if (board.data.post_type !== 'series') {
        return Response.json({ error: '연재형 게시판에서만 연재를 선택할 수 있습니다.' }, { status: 400 });
      }

      const seriesResult = await supabaseAdmin
        .from('board_series')
        .select('id, is_completed, user_id')
        .eq('site_id', rhizome.data.id)
        .eq('board_id', board.data.id)
        .eq('series_key', seriesKey)
        .maybeSingle();

      if (seriesResult.error || !seriesResult.data) {
        return Response.json({ error: '연재를 찾을 수 없습니다.' }, { status: 404 });
      }

      if (seriesResult.data.is_completed) {
        return Response.json({ error: '완결된 연재는 선택할 수 없습니다.' }, { status: 400 });
      }

      if (seriesResult.data.user_id && seriesResult.data.user_id !== session.particleId) {
        return Response.json({ error: '해당 연재를 선택할 권한이 없습니다.' }, { status: 403 });
      }

      seriesId = seriesResult.data.id;
    }

    if (!seriesKey && board.data.post_type === 'series') {
      return Response.json({ error: '연재형 게시판은 연재를 선택해야 합니다.' }, { status: 400 });
    }

    let resolvedPrefixId: string | null = null;

    if (prefixId) {
      if (board.data.post_type !== 'prefix') {
        return Response.json({ error: '말머리형 게시판에서만 말머리를 선택할 수 있습니다.' }, { status: 400 });
      }

      const prefixResult = await supabaseAdmin
        .from('board_prefixes')
        .select('id')
        .eq('site_id', rhizome.data.id)
        .eq('board_id', board.data.id)
        .eq('id', prefixId)
        .maybeSingle();

      if (prefixResult.error || !prefixResult.data) {
        return Response.json({ error: '말머리를 찾을 수 없습니다.' }, { status: 404 });
      }

      resolvedPrefixId = prefixResult.data.id;
    }

    if (!prefixId && board.data.post_type === 'prefix') {
      return Response.json({ error: '말머리형 게시판은 말머리를 선택해야 합니다.' }, { status: 400 });
    }

    const lastPost = await supabaseAdmin
      .from('posts')
      .select('idx, slug')
      .eq('board_id', board.data.id)
      .order('idx', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastPost.error) {
      return Response.json({ error: '글 작성에 실패했습니다.' }, { status: 500 });
    }

    const nextIdx = typeof lastPost.data?.idx === 'number' ? Number(lastPost.data.idx) + 1 : 1;
    const nextSlug = typeof lastPost.data?.slug === 'number' ? Number(lastPost.data.slug) + 1 : Date.now();

    const insertPost = await supabaseAdmin
      .from('posts')
      .insert({
        slug: nextSlug,
        subject,
        summary: summary || null,
        content_html: contentHtml,
        content_markdown: contentMarkdown,
        thumbnail_image: thumbnailImage || null,
        thumbnail_width: thumbnailWidth,
        thumbnail_height: thumbnailHeight,
        idx: nextIdx,
        user_id: session.particleId,
        site_id: rhizome.data.id,
        board_id: board.data.id,
        is_closed: false,
        categories: categoryIds,
        series_id: seriesId,
        prefix_id: resolvedPrefixId,
      })
      .select('id, slug')
      .maybeSingle();

    if (insertPost.error || !insertPost.data) {
      return Response.json({ error: '글 작성에 실패했습니다.' }, { status: 500 });
    }

    if (seriesId) {
      await supabaseAdmin
        .from('board_series')
        .update({
          last_published_at: new Date().toISOString(),
        })
        .eq('id', seriesId);
    }

    return Response.json({
      ok: true,
      slug: String(insertPost.data.slug),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '글 작성에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '글 작성에 실패했습니다.' }, { status: 500 });
  }
}
