import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
    contentId: string;
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
  isClosed?: boolean | null;
};

function isNumericSlug(value: string) {
  return /^\d+$/.test(value);
}

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

export async function PATCH(request: Request, context: RouteContext) {
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

    const requestBody = (await request.json()) as RequestBody;

    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    const subject = normalizeText(requestBody.subject);
    const summary = normalizeText(requestBody.summary);
    const contentHtml = normalizeText(requestBody.contentHtml);
    const contentMarkdown = normalizeText(requestBody.contentMarkdown);
    const thumbnailImage = normalizeText(requestBody.thumbnailImage);
    const seriesKey = normalizeText(requestBody.seriesKey).toLowerCase();
    const prefixId = normalizeText(requestBody.prefixId);
    const isClosed = typeof requestBody.isClosed === 'boolean' ? requestBody.isClosed : null;
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

    if (requestBody.subject !== undefined && !subject) {
      return Response.json({ error: '제목을 입력해주세요.' }, { status: 400 });
    }

    if (
      (requestBody.contentHtml !== undefined && !contentHtml) ||
      (requestBody.contentMarkdown !== undefined && !contentMarkdown)
    ) {
      return Response.json({ error: '내용을 입력해주세요.' }, { status: 400 });
    }

    if (seriesKey && !isValidSeriesKey(seriesKey)) {
      return Response.json({ error: '연재 식별자가 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id, site_type').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (session.status === 'FAIL') {
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
      return Response.json({ error: '페이지 게시판에는 글을 수정할 수 없습니다.' }, { status: 403 });
    }

    const postQuery = supabaseAdmin
      .from('posts')
      .select('id, slug, user_id, board_id, site_id, is_closed, series_id, prefix_id')
      .eq('board_id', board.data.id);

    const currentPost = isNumericSlug(normalizedContentId)
      ? await postQuery.eq('slug', Number(normalizedContentId)).maybeSingle()
      : await postQuery.eq('id', normalizedContentId).maybeSingle();

    if (currentPost.error || !currentPost.data) {
      return Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const isStaff = session.case === 'staff';
    const isAuthor = currentPost.data.user_id === session.particleId;

    if (!isStaff && !isAuthor) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    let categoryIds: string[] = [];

    if (requestBody.categories !== undefined && categoryKeys.length > 0) {
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

    let seriesId: string | null | undefined = undefined;

    if (requestBody.seriesKey !== undefined) {
      if (seriesKey && (board.data.post_type === 'none' || board.data.post_type === 'prefix')) {
        return Response.json({ error: '연재형 게시판에서만 연재를 선택할 수 있습니다.' }, { status: 400 });
      }

      if (!seriesKey && board.data.post_type === 'series') {
        return Response.json({ error: '연재형 게시판은 연재를 선택해야 합니다.' }, { status: 400 });
      }

      if (currentPost.data.series_id && seriesKey) {
        const currentSeries = await supabaseAdmin
          .from('board_series')
          .select('series_key')
          .eq('id', currentPost.data.series_id)
          .maybeSingle();

        if (currentSeries.error || !currentSeries.data) {
          return Response.json({ error: '연재 정보를 확인하지 못했습니다.' }, { status: 500 });
        }

        if (currentSeries.data.series_key !== seriesKey) {
          return Response.json({ error: '연재가 설정된 글은 연재를 변경할 수 없습니다.' }, { status: 400 });
        }

        seriesId = currentPost.data.series_id;
      } else if (currentPost.data.series_id && !seriesKey) {
        return Response.json({ error: '연재가 설정된 글은 연재를 변경할 수 없습니다.' }, { status: 400 });
      } else if (!currentPost.data.series_id && seriesKey) {
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
      } else {
        seriesId = null;
      }
    }

    let resolvedPrefixId: string | null | undefined = undefined;

    if (requestBody.prefixId !== undefined) {
      if (prefixId && board.data.post_type !== 'prefix') {
        return Response.json({ error: '말머리형 게시판에서만 말머리를 선택할 수 있습니다.' }, { status: 400 });
      }

      if (!prefixId && board.data.post_type === 'prefix') {
        return Response.json({ error: '말머리형 게시판은 말머리를 선택해야 합니다.' }, { status: 400 });
      }

      if (prefixId) {
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
      } else {
        resolvedPrefixId = null;
      }
    }

    const updatePayload: {
      subject?: string;
      summary?: string | null;
      content_html?: string;
      content_markdown?: string;
      thumbnail_image?: string | null;
      thumbnail_width?: number | null;
      thumbnail_height?: number | null;
      categories?: string[];
      series_id?: string | null;
      prefix_id?: string | null;
      is_closed?: boolean;
    } = {};

    if (requestBody.subject !== undefined) {
      updatePayload.subject = subject;
    }

    if (requestBody.summary !== undefined) {
      updatePayload.summary = summary || null;
    }

    if (requestBody.contentHtml !== undefined) {
      updatePayload.content_html = contentHtml;
    }

    if (requestBody.contentMarkdown !== undefined) {
      updatePayload.content_markdown = contentMarkdown;
    }

    if (requestBody.thumbnailImage !== undefined) {
      updatePayload.thumbnail_image = thumbnailImage || null;
      updatePayload.thumbnail_width = thumbnailWidth;
      updatePayload.thumbnail_height = thumbnailHeight;
    }

    if (requestBody.categories !== undefined) {
      updatePayload.categories = categoryIds;
    }

    if (seriesId !== undefined) {
      updatePayload.series_id = seriesId;
    }

    if (resolvedPrefixId !== undefined) {
      updatePayload.prefix_id = resolvedPrefixId;
    }

    if (isClosed !== null) {
      if (!isStaff && !isAuthor) {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }

      updatePayload.is_closed = isClosed;
    }

    const updatePost = await supabaseAdmin
      .from('posts')
      .update(updatePayload)
      .eq('id', currentPost.data.id)
      .select('id, slug, series_id')
      .maybeSingle();

    if (updatePost.error || !updatePost.data) {
      return Response.json({ error: '글 수정에 실패했습니다.' }, { status: 500 });
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
      slug: String(updatePost.data.slug),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '글 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '글 수정에 실패했습니다.' }, { status: 500 });
  }
}
