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
  categories: Array<{
    categoryName: string | null;
    sortOrder: number | null;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { boardName } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const categories = Array.isArray(requestBody.categories) ? requestBody.categories : [];

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (categories.length === 0) {
      return Response.json({ error: '정렬할 카테고리가 없습니다.' }, { status: 400 });
    }

    const normalizedCategories = categories.map((category) => ({
      categoryName: normalizeText(category.categoryName).toLowerCase(),
      sortOrder: typeof category.sortOrder === 'number' ? Math.floor(category.sortOrder) : Number(category.sortOrder),
    }));

    if (
      normalizedCategories.some(
        (category) => !category.categoryName || !Number.isFinite(category.sortOrder) || category.sortOrder < 1,
      )
    ) {
      return Response.json({ error: '카테고리 정렬 정보가 유효하지 않습니다.' }, { status: 400 });
    }

    const uniqueCategoryNames = new Set(normalizedCategories.map((category) => category.categoryName));

    if (uniqueCategoryNames.size !== normalizedCategories.length) {
      return Response.json({ error: '중복된 카테고리 식별자가 포함되어 있습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id, site_type').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (rhizome.data.site_type !== 'blog') {
      return Response.json({ error: '카테고리는 블로그에서만 사용할 수 있습니다.' }, { status: 403 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

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

    if (board.data.board_type !== 'blog') {
      return Response.json({ error: '블로그 게시판만 카테고리를 사용할 수 있습니다.' }, { status: 403 });
    }

    const existingCategories = await supabaseAdmin
      .from('board_categories')
      .select('id, category_key')
      .eq('site_id', rhizome.data.id)
      .eq('board_id', board.data.id)
      .in(
        'category_key',
        normalizedCategories.map((category) => category.categoryName),
      );

    if (existingCategories.error) {
      return Response.json({ error: '카테고리 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if ((existingCategories.data ?? []).length !== normalizedCategories.length) {
      return Response.json({ error: '일부 카테고리를 찾을 수 없습니다.' }, { status: 404 });
    }

    const categoryIdMap = new Map(
      (existingCategories.data ?? []).map((category) => [category.category_key as string, category.id as string]),
    );

    for (const category of normalizedCategories) {
      const categoryId = categoryIdMap.get(category.categoryName);

      if (!categoryId) {
        return Response.json({ error: '일부 카테고리를 찾을 수 없습니다.' }, { status: 404 });
      }

      const updateResult = await supabaseAdmin
        .from('board_categories')
        .update({
          sort_order: category.sortOrder,
        })
        .eq('id', categoryId);

      if (updateResult.error) {
        return Response.json({ error: '카테고리 순서 저장에 실패했습니다.' }, { status: 500 });
      }
    }

    return Response.json({
      ok: true,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '카테고리 순서 저장에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '카테고리 순서 저장에 실패했습니다.' }, { status: 500 });
  }
}
