import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type PlanFeatureRow = {
  count_board: number | null;
  count_subpage: number | null;
};

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: string;
  is_active: boolean;
  sort_order: number | null;
  markdown_status: string | null;
  site_id: string;
  created_at: string;
  post_per_page: number | null;
};

function toNonNegativeInteger(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
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
      .select('id, visibility_type, is_shutdown, plan_type')
      .eq('site_key', siteName)
      .maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    const isStaff = session.case === 'staff';
    const isMember = session.case === 'member';

    if (rhizome.data.visibility_type !== 'public' || rhizome.data.is_shutdown !== false) {
      if (!isStaff) {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    if (!isStaff && !isMember) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const boards = await supabaseAdmin
      .from('boards')
      .select(
        'id, board_key, board_label, board_type, is_active, sort_order, markdown_status, site_id, created_at, post_per_page',
      )
      .eq('site_id', rhizome.data.id)
      .order('sort_order', { ascending: true });

    if (boards.error) {
      return Response.json({ error: '게시판을 불러오지 못했습니다.' }, { status: 500 });
    }

    const planFeatureResult = await supabaseAdmin
      .from('plan_features')
      .select('count_board, count_subpage')
      .eq('plan_id', rhizome.data.plan_type)
      .maybeSingle();

    if (planFeatureResult.error || !planFeatureResult.data) {
      return Response.json({ error: '게시판을 불러오지 못했습니다.' }, { status: 500 });
    }

    const planFeature = planFeatureResult.data as PlanFeatureRow;
    const maxBoardCount = Math.max(
      0,
      toNonNegativeInteger(planFeature.count_board) - toNonNegativeInteger(planFeature.count_subpage),
    );

    const boardRows = (boards.data ?? []) as BoardRow[];
    const currentBoardCount = boardRows.filter((board) => board.board_type !== 'page').length;

    const writeBoards = boardRows.filter((board) => board.is_active === true && board.board_type !== 'page');

    return Response.json({
      boards: boardRows,
      writeBoards,
      limit: {
        maxBoardCount,
        currentBoardCount,
        canCreateBoard: currentBoardCount < maxBoardCount,
      },
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시판을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시판을 불러오지 못했습니다.' }, { status: 500 });
  }
}
