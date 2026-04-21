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

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (session.status === 'FAIL' || session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, post_type')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (rhizome.data.site_type !== 'community') {
      return Response.json({ error: '커뮤니티에서만 말머리를 사용할 수 있습니다.' }, { status: 403 });
    }

    if (board.data.post_type !== 'prefix') {
      return Response.json({ error: '말머리형 게시판이 아닙니다.' }, { status: 403 });
    }

    const prefixes = await supabaseAdmin
      .from('board_prefixes')
      .select('id, created_at, prefix_key, prefix_label, board_id, site_id')
      .eq('site_id', rhizome.data.id)
      .eq('board_id', board.data.id)
      .order('prefix_key', { ascending: true })
      .order('created_at', { ascending: true });

    if (prefixes.error) {
      return Response.json({ error: '말머리 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      board,
      prefixes: prefixes.data ?? [],
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '말머리 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '말머리 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
