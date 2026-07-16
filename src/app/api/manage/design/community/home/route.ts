import { getCommunityManagerAccess } from '@/lib/community/community-manager/utils';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

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
  board_type: string;
  is_active: boolean;
  sort_order: number | null;
};

type SaveOrderItem = {
  id: string;
  order: number;
  isShow: boolean;
};

type RequestBody = {
  action?: 'init' | 'save' | null;
  siteName?: string | null;
  items?: SaveOrderItem[];
};

async function checkAccess(siteName: string) {
  try {
    const access = await getCommunityManagerAccess(siteName);

    if (!access.actor.permissions.site_edit) {
      return {
        ok: false,
        status: 403,
        error: '접근 권한이 없습니다.',
      } as const;
    }

    return {
      ok: true,
      access,
    } as const;
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return {
        ok: false,
        status: 403,
        error: unknownError.message || '접근 권한이 없습니다.',
      } as const;
    }

    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }
}

function serializeItem(board: BoardRow, homeOrder: HomeOrderRow | null) {
  return {
    id: homeOrder?.id ?? '',
    boardId: board.id,
    boardKey: board.board_key,
    boardLabel: board.board_label,
    boardType: board.board_type,
    isActive: board.is_active,
    order: homeOrder?.order ?? Number(board.sort_order ?? 0),
    isShow: homeOrder?.is_show ?? true,
    hasHomeOrder: Boolean(homeOrder),
  };
}

async function getBoards(siteId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const boards = await supabaseAdmin
    .from('boards')
    .select('id, board_key, board_label, board_type, is_active, sort_order')
    .eq('site_id', siteId)
    .neq('board_type', 'page')
    .order('sort_order', { ascending: true });

  if (boards.error) {
    return {
      ok: false,
      error: '게시판 목록을 불러오지 못했습니다.',
    } as const;
  }

  return {
    ok: true,
    boards: (boards.data ?? []) as BoardRow[],
  } as const;
}

async function getHomeOrders(siteId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const homeOrders = await supabaseAdmin
    .from('community_home_orders')
    .select('id, site_id, board_id, order, is_show')
    .eq('site_id', siteId)
    .order('order', { ascending: true });

  if (homeOrders.error) {
    return {
      ok: false,
      error: '커뮤니티 홈 순서를 불러오지 못했습니다.',
    } as const;
  }

  return {
    ok: true,
    homeOrders: (homeOrders.data ?? []) as HomeOrderRow[],
  } as const;
}

async function getHomeItems(siteId: string) {
  const boardsResult = await getBoards(siteId);

  if (!boardsResult.ok) {
    return boardsResult;
  }

  const homeOrdersResult = await getHomeOrders(siteId);

  if (!homeOrdersResult.ok) {
    return homeOrdersResult;
  }

  const homeOrderMap = new Map(homeOrdersResult.homeOrders.map((homeOrder) => [homeOrder.board_id, homeOrder]));
  const hasHomeOrders = homeOrdersResult.homeOrders.length > 0;

  const items = boardsResult.boards
    .map((board) => serializeItem(board, homeOrderMap.get(board.id) ?? null))
    .sort((a, b) => {
      if (hasHomeOrders) {
        return a.order - b.order;
      }

      return a.order - b.order;
    });

  return {
    ok: true,
    items,
    hasHomeOrders,
  } as const;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const accessResult = await checkAccess(siteName);

    if (!accessResult.ok) {
      return Response.json({ error: accessResult.error }, { status: accessResult.status });
    }

    const homeItemsResult = await getHomeItems(accessResult.access.rhizome.id);

    if (!homeItemsResult.ok) {
      return Response.json({ error: homeItemsResult.error }, { status: 500 });
    }

    return Response.json({
      ok: true,
      hasHomeOrders: homeItemsResult.hasHomeOrders,
      items: homeItemsResult.items,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '커뮤니티 홈 설정을 불러오지 못했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '커뮤니티 홈 설정을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (requestBody.action !== 'init') {
      return Response.json({ error: '지원하지 않는 요청입니다.' }, { status: 400 });
    }

    const accessResult = await checkAccess(siteName);

    if (!accessResult.ok) {
      return Response.json({ error: accessResult.error }, { status: accessResult.status });
    }

    const siteId = accessResult.access.rhizome.id;
    const supabaseAdmin = getSupabaseAdmin();

    const homeOrdersResult = await getHomeOrders(siteId);

    if (!homeOrdersResult.ok) {
      return Response.json({ error: homeOrdersResult.error }, { status: 500 });
    }

    if (homeOrdersResult.homeOrders.length > 0) {
      const homeItemsResult = await getHomeItems(siteId);

      if (!homeItemsResult.ok) {
        return Response.json({ error: homeItemsResult.error }, { status: 500 });
      }

      return Response.json({
        ok: true,
        hasHomeOrders: true,
        items: homeItemsResult.items,
      });
    }

    const boardsResult = await getBoards(siteId);

    if (!boardsResult.ok) {
      return Response.json({ error: boardsResult.error }, { status: 500 });
    }

    if (boardsResult.boards.length > 0) {
      const insertResult = await supabaseAdmin.from('community_home_orders').insert(
        boardsResult.boards.map((board, index) => ({
          site_id: siteId,
          board_id: board.id,
          order: index + 1,
          is_show: true,
        })),
      );

      if (insertResult.error) {
        return Response.json({ error: '커뮤니티 홈 초기 세팅에 실패했습니다.' }, { status: 500 });
      }
    }

    const homeItemsResult = await getHomeItems(siteId);

    if (!homeItemsResult.ok) {
      return Response.json({ error: homeItemsResult.error }, { status: 500 });
    }

    return Response.json({
      ok: true,
      hasHomeOrders: homeItemsResult.hasHomeOrders,
      items: homeItemsResult.items,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '커뮤니티 홈 초기 세팅에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '커뮤니티 홈 초기 세팅에 실패했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const items = Array.isArray(requestBody.items) ? requestBody.items : [];

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (items.length === 0) {
      return Response.json({ error: '저장할 항목이 없습니다.' }, { status: 400 });
    }

    const accessResult = await checkAccess(siteName);

    if (!accessResult.ok) {
      return Response.json({ error: accessResult.error }, { status: accessResult.status });
    }

    const siteId = accessResult.access.rhizome.id;
    const supabaseAdmin = getSupabaseAdmin();

    const currentOrdersResult = await getHomeOrders(siteId);

    if (!currentOrdersResult.ok) {
      return Response.json({ error: currentOrdersResult.error }, { status: 500 });
    }

    const currentIdSet = new Set(currentOrdersResult.homeOrders.map((homeOrder) => homeOrder.id));

    const invalidItem = items.find((item) => !currentIdSet.has(item.id));

    if (invalidItem) {
      return Response.json({ error: '저장할 수 없는 항목이 포함되어 있습니다.' }, { status: 400 });
    }

    for (const item of items) {
      const updateResult = await supabaseAdmin
        .from('community_home_orders')
        .update({
          order: item.order,
          is_show: item.isShow,
        })
        .eq('id', item.id)
        .eq('site_id', siteId);

      if (updateResult.error) {
        return Response.json({ error: '커뮤니티 홈 순서 저장에 실패했습니다.' }, { status: 500 });
      }
    }

    const homeItemsResult = await getHomeItems(siteId);

    if (!homeItemsResult.ok) {
      return Response.json({ error: homeItemsResult.error }, { status: 500 });
    }

    return Response.json({
      ok: true,
      hasHomeOrders: homeItemsResult.hasHomeOrders,
      items: homeItemsResult.items,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '커뮤니티 홈 순서 저장에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '커뮤니티 홈 순서 저장에 실패했습니다.' }, { status: 500 });
  }
}
