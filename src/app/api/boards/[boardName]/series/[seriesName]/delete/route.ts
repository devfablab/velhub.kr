import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
    seriesName: string;
  }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { boardName, seriesName } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const normalizedSeriesName = normalizeText(seriesName).toLowerCase();

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!normalizedSeriesName) {
      return Response.json({ error: 'seriesName이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

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
      .select('id, board_type')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (board.data.board_type === 'page') {
      return Response.json({ error: '페이지 게시판은 시리즈를 사용할 수 없습니다.' }, { status: 403 });
    }

    const currentSeries = await supabaseAdmin
      .from('board_series')
      .select('id')
      .eq('site_id', rhizome.data.id)
      .eq('board_id', board.data.id)
      .eq('series_key', normalizedSeriesName)
      .maybeSingle();

    if (currentSeries.error || !currentSeries.data) {
      return Response.json({ error: '시리즈를 찾을 수 없습니다.' }, { status: 404 });
    }

    const linkedPost = await supabaseAdmin
      .from('posts')
      .select('id')
      .eq('site_id', rhizome.data.id)
      .eq('board_id', board.data.id)
      .eq('series_id', currentSeries.data.id)
      .limit(1)
      .maybeSingle();

    if (linkedPost.error) {
      return Response.json({ error: '시리즈 삭제 가능 여부를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (linkedPost.data) {
      return Response.json({ error: '이미 연재가 시작된 시리즈는 삭제할 수 없습니다.' }, { status: 400 });
    }

    const deleteSeries = await supabaseAdmin.from('board_series').delete().eq('id', currentSeries.data.id);

    if (deleteSeries.error) {
      return Response.json({ error: '시리즈 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '시리즈 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '시리즈 삭제에 실패했습니다.' }, { status: 500 });
  }
}
