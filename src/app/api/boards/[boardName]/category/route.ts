import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { boardName } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
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

    const categories = await supabaseAdmin
      .from('board_categories')
      .select('id, category_key, category_label, summary, thumbnail_image, sort_order, board_id, site_id, created_at')
      .eq('site_id', rhizome.data.id)
      .eq('board_id', board.data.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (categories.error) {
      return Response.json({ error: '카테고리 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      board: board.data,
      categories: categories.data ?? [],
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '카테고리 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '카테고리 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
