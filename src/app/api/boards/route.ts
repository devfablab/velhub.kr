import { canManageAllCommunityBoardContents, getCommunityManagerAccess } from '@/lib/community/community-manager/utils';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: string;
  is_active: boolean;
  sort_order: number | null;
  markdown_status: string;
  site_id: string;
  created_at: string;
  post_per_page: number | null;
};

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 400 });
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
    const isManageContentsRequest = requestUrl.searchParams.get('manageContents') === 'true';

    const isAuth = session.case === 'admin' || session.case === 'staff' || session.case === 'member';

    if (rhizome.data.visibility_type !== 'public' || rhizome.data.is_shutdown !== false) {
      if (!isAuth) {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    let managedBoardIds: string[] | null = null;
    let manageContents: {
      canCreateBoard: boolean;
      canOrderBoards: boolean;
      canEditAllBoards: boolean;
      editableBoardIds: string[];
    } | null = null;

    if (isManageContentsRequest && rhizome.data.site_type === 'community') {
      try {
        const access = await getCommunityManagerAccess(siteName, { requireManagerControlPermission: false });
        const canEditAllBoards =
          access.actor.communityRoles.includes('owner') || access.actor.communityRoles.includes('community-manager');

        manageContents = {
          canCreateBoard: canEditAllBoards,
          canOrderBoards: canEditAllBoards,
          canEditAllBoards,
          editableBoardIds: access.actor.managedBoardGeneralIds,
        };

        if (!canManageAllCommunityBoardContents(access.actor)) {
          managedBoardIds = access.actor.managedBoardIds;
        }
      } catch {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    let boardsQuery = supabaseAdmin
      .from('boards')
      .select(
        'id, board_key, board_label, board_type, is_active, sort_order, markdown_status, site_id, created_at, post_per_page',
      )
      .eq('site_id', rhizome.data.id)
      .order('sort_order', { ascending: true });

    if (managedBoardIds !== null) {
      boardsQuery = boardsQuery.in('id', managedBoardIds);
    }

    const boards = await boardsQuery;

    if (boards.error) {
      return Response.json({ error: '게시판을 불러오지 못했습니다.' }, { status: 500 });
    }

    const boardRows = (boards.data ?? []) as BoardRow[];

    const currentBoardCount = boardRows.filter((board) => board.board_type !== 'page').length;

    const writeBoards = boardRows.filter((board) => board.is_active === true && board.board_type !== 'page');

    return Response.json({
      boards: boardRows,
      manageContents,
      writeBoards,
      limit: {
        maxBoardCount: 0,
        currentBoardCount,
        canCreateBoard: true,
      },
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시판을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시판을 불러오지 못했습니다.' }, { status: 500 });
  }
}
