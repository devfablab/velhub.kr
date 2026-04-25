import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
    categoryName: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { boardName, categoryName } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const normalizedCategoryName = normalizeText(categoryName).toLowerCase();

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!normalizedCategoryName) {
      return Response.json({ error: 'categoryName이 유효하지 않습니다.' }, { status: 400 });
    }

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

    if (rhizome.data.site_type !== 'blog') {
      return Response.json({ error: '카테고리는 블로그에서만 사용할 수 있습니다.' }, { status: 403 });
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

    if (board.data.board_type !== 'blog') {
      return Response.json({ error: '블로그 게시판만 카테고리를 사용할 수 있습니다.' }, { status: 403 });
    }

    const category = await supabaseAdmin
      .from('board_categories')
      .select('id, category_key, category_label, summary, thumbnail_image, sort_order, board_id, site_id, created_at')
      .eq('site_id', rhizome.data.id)
      .eq('board_id', board.data.id)
      .eq('category_key', normalizedCategoryName)
      .maybeSingle();

    if (category.error) {
      return Response.json({ error: '카테고리 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!category.data) {
      return Response.json({ error: '카테고리를 찾을 수 없습니다.' }, { status: 404 });
    }

    return Response.json({
      board: board.data,
      category: category.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '카테고리 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '카테고리 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
