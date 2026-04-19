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

    if (session.status === 'FAIL' || session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (rhizome.data.site_type !== 'blog') {
      return Response.json({ error: '블로그에서만 글을 작성할 수 있습니다.' }, { status: 403 });
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_type, site_id')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (board.data.board_type !== 'blog') {
      return Response.json({ error: '블로그 게시판만 글을 작성할 수 있습니다.' }, { status: 403 });
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
        content: contentHtml,
        markdown: contentMarkdown,
        thumbnail_image: thumbnailImage || null,
        thumbnail_width: thumbnailWidth,
        thumbnail_height: thumbnailHeight,
        idx: nextIdx,
        user_id: session.particleId,
        site_id: rhizome.data.id,
        board_id: board.data.id,
        is_closed: false,
        categories: categoryIds,
      })
      .select('id, slug')
      .maybeSingle();

    if (insertPost.error || !insertPost.data) {
      return Response.json({ error: '글 작성에 실패했습니다.' }, { status: 500 });
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
