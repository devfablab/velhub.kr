import verifySession from '@/lib/session/verifySession';
import { getPostList } from '@/lib/board/getPostList';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type BoardType = 'basic' | 'gallery' | 'youtube' | 'feed' | 'page';

type HomeOrderRow = {
  id: string;
  site_id: string;
  board_id: string;
  order: number;
  is_show: boolean;
};

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: BoardType;
  markdown_status: string | null;
  post_type: 'none' | 'prefix' | 'series' | null;
  is_active: boolean;
  sort_order: number | null;
};

function getBoardContentSize(boardType: BoardType) {
  if (boardType === 'basic') {
    return 5;
  }

  return 3;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_type, visibility_type, is_shutdown')
      .eq('site_key', siteName)
      .maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const rhizomeData = rhizome.data;

    if (rhizomeData.site_type !== 'community') {
      return Response.json({ error: '커뮤니티 사이트가 아닙니다.' }, { status: 400 });
    }

    const session = await verifySession({
      siteId: rhizomeData.id,
    });

    if (rhizomeData.visibility_type !== 'public' || rhizomeData.is_shutdown !== false) {
      if (session.case !== 'staff') {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const homeOrders = await supabaseAdmin
      .from('community_home_orders')
      .select('id, site_id, board_id, order, is_show')
      .eq('site_id', rhizomeData.id)
      .eq('is_show', true)
      .order('order', { ascending: true });

    if (homeOrders.error) {
      return Response.json({ error: '커뮤니티 홈 설정을 불러오지 못했습니다.' }, { status: 500 });
    }

    const orders = (homeOrders.data ?? []) as HomeOrderRow[];
    const boardIds = orders.map((order) => order.board_id);

    if (boardIds.length === 0) {
      return Response.json({
        ok: true,
        boards: [],
      });
    }

    const boards = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, markdown_status, post_type, is_active, sort_order')
      .eq('site_id', rhizomeData.id)
      .eq('is_active', true)
      .in('id', boardIds)
      .neq('board_type', 'page');

    if (boards.error) {
      return Response.json({ error: '게시판 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const boardMap = new Map(((boards.data ?? []) as BoardRow[]).map((board) => [board.id, board]));
    const postListSessionCase =
      session.case === 'admin' || session.case === 'staff' ? 'staff' : session.case === 'member' ? 'member' : 'guest';

    const homeBoards = await Promise.all(
      orders
        .map((order) => boardMap.get(order.board_id) ?? null)
        .filter((board): board is BoardRow => Boolean(board))
        .map(async (board) => {
          const postList = await getPostList({
            siteId: rhizomeData.id,
            siteKey: siteName,
            boardId: board.id,
            page: 1,
            size: getBoardContentSize(board.board_type),
            filter: 'all',
            sessionCase: postListSessionCase,
            authUserId: session.authUserId ?? null,
            sort: 'latest',
            includePin: false,
          });

          return {
            board,
            contents: postList.contents,
          };
        }),
    );

    return Response.json({
      ok: true,
      boards: homeBoards,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '커뮤니티 홈을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '커뮤니티 홈을 불러오지 못했습니다.' }, { status: 500 });
  }
}
