import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
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
      .select('id, visibility_type, is_shutdown')
      .eq('site_key', siteName)
      .maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const isPublicReadable = rhizome.data.visibility_type === 'public' && rhizome.data.is_shutdown === false;

    if (!isPublicReadable) {
      const session = await verifySession({
        siteId: rhizome.data.id,
      });

      if (session.status === 'FAIL') {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }

      if (session.case !== 'staff') {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const boards = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, is_active, sort_order, markdown_status, site_id')
      .eq('site_id', rhizome.data.id)
      .order('sort_order', { ascending: true });

    if (boards.error) {
      return Response.json({ error: '게시판 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      boards: boards.data ?? [],
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시판 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시판 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
