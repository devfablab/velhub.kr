import { decrypt } from '@/lib/encryption/decrypt';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
    seriesName: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
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

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, post_type, site_id, created_at, is_subscription')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (board.data.board_type === 'page') {
      return Response.json({ error: '페이지 게시판은 연재를 사용할 수 없습니다.' }, { status: 403 });
    }

    const seriesResult = await supabaseAdmin
      .from('board_series')
      .select(
        'id, created_at, series_key, series_label, summary, thumbnail_image, board_id, site_id, last_published_at, is_completed, user_id, is_subscription',
      )
      .eq('site_id', rhizome.data.id)
      .eq('board_id', board.data.id)
      .eq('series_key', normalizedSeriesName)
      .maybeSingle();

    if (seriesResult.error || !seriesResult.data) {
      return Response.json({ error: '연재를 찾을 수 없습니다.' }, { status: 404 });
    }

    let selectedUser: {
      particleId: string;
      email: string;
      userName: string;
      nickname: string;
    } | null = null;

    if (seriesResult.data.user_id) {
      const [stigmaResult, memberResult] = await Promise.all([
        supabaseAdmin
          .from('stigmas')
          .select('user_id, email, user_name')
          .eq('user_id', seriesResult.data.user_id)
          .maybeSingle(),
        supabaseAdmin
          .from('rhizome_stigmas')
          .select('user_id, nickname')
          .eq('site_id', rhizome.data.id)
          .eq('user_id', seriesResult.data.user_id)
          .maybeSingle(),
      ]);

      if (stigmaResult.error) {
        return Response.json({ error: '사용자 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      if (memberResult.error) {
        return Response.json({ error: '사용자 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      selectedUser = {
        particleId: seriesResult.data.user_id,
        email: stigmaResult.data?.email ? decrypt(stigmaResult.data.email as string) : '',
        userName: stigmaResult.data?.user_name ? decrypt(stigmaResult.data.user_name as string) : '',
        nickname: memberResult.data?.nickname ?? '',
      };
    }

    return Response.json({
      board: {
        ...board.data,
        post_type: board.data.post_type ?? 'none',
      },
      series: seriesResult.data,
      selectedUser,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '연재 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '연재 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
