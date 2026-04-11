import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestUrl = new URL(request.url);
    const siteName = requestUrl.searchParams.get('siteName')?.trim().toLowerCase() ?? '';

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error || !stigmaResult.data) {
      return Response.json({ error: '사용자 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const rhizomeResult = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (rhizomeResult.error || !rhizomeResult.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const manageResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('role')
      .eq('site_id', rhizomeResult.data.id)
      .eq('user_id', stigmaResult.data.id)
      .in('role', ['owner', 'manager'])
      .maybeSingle();

    if (manageResult.error || !manageResult.data) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const boardResult = await supabaseAdmin
      .from('boards')
      .select('id, board_key')
      .eq('site_id', rhizomeResult.data.id)
      .eq('board_key', 'p')
      .eq('board_type', 'page')
      .maybeSingle();

    if (boardResult.error) {
      return Response.json({ error: '페이지 게시판 상태를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      hasBoard: Boolean(boardResult.data),
      boardName: boardResult.data?.board_key ?? null,
      boardId: boardResult.data?.id ?? null,
      siteId: rhizomeResult.data.id,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '페이지 게시판 상태를 불러오지 못했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '페이지 게시판 상태를 불러오지 못했습니다.' }, { status: 500 });
  }
}
