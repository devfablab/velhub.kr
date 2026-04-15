import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

export async function GET(request: Request) {
  try {
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
      return Response.json({ error: '블로그 사이트만 접근할 수 있습니다.' }, { status: 403 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (session.status === 'FAIL') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_key')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', 'b')
      .eq('board_type', 'blog')
      .maybeSingle();

    if (board.error) {
      return Response.json({ error: '블로그 게시판 상태를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      hasBoard: Boolean(board.data),
      boardName: board.data?.board_key ?? null,
      boardId: board.data?.id ?? null,
      siteId: rhizome.data.id,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '블로그 게시판 상태를 불러오지 못했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '블로그 게시판 상태를 불러오지 못했습니다.' }, { status: 500 });
  }
}
