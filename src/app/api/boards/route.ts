import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

type AccessResult = {
  ok: boolean;
  status: number;
  error?: string;
  siteId?: string;
};

async function checkReadAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizomeResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, visibility_type, is_shutdown')
    .eq('site_key', siteName)
    .maybeSingle();

  if (rhizomeResult.error || !rhizomeResult.data) {
    return {
      ok: false,
      status: 404,
      error: '사이트를 찾을 수 없습니다.',
    } satisfies AccessResult;
  }

  const rhizome = rhizomeResult.data;

  const sessionClaims = await getSessionClaims();

  if (rhizome.is_shutdown) {
    if (!sessionClaims) {
      return {
        ok: false,
        status: 401,
        error: '로그인이 필요합니다.',
      } satisfies AccessResult;
    }

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error || !stigmaResult.data) {
      return {
        ok: false,
        status: 500,
        error: '사용자 정보를 확인하지 못했습니다.',
      } satisfies AccessResult;
    }

    const manageResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('role')
      .eq('site_id', rhizome.id)
      .eq('user_id', stigmaResult.data.id)
      .in('role', ['owner', 'manager'])
      .maybeSingle();

    if (manageResult.error || !manageResult.data) {
      return {
        ok: false,
        status: 403,
        error: '접근 권한이 없습니다.',
      } satisfies AccessResult;
    }

    return {
      ok: true,
      status: 200,
      siteId: rhizome.id,
    } satisfies AccessResult;
  }

  if (rhizome.visibility_type === 'public') {
    return {
      ok: true,
      status: 200,
      siteId: rhizome.id,
    } satisfies AccessResult;
  }

  if (!sessionClaims) {
    return {
      ok: false,
      status: 401,
      error: '로그인이 필요합니다.',
    } satisfies AccessResult;
  }

  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('id')
    .eq('user_id', sessionClaims.userId)
    .maybeSingle();

  if (stigmaResult.error || !stigmaResult.data) {
    return {
      ok: false,
      status: 500,
      error: '사용자 정보를 확인하지 못했습니다.',
    } satisfies AccessResult;
  }

  const accessResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('id')
    .eq('site_id', rhizome.id)
    .eq('user_id', stigmaResult.data.id)
    .eq('is_approval', true)
    .eq('is_block', false)
    .maybeSingle();

  if (accessResult.error || !accessResult.data) {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } satisfies AccessResult;
  }

  return {
    ok: true,
    status: 200,
    siteId: rhizome.id,
  } satisfies AccessResult;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const accessResult = await checkReadAccess(siteName);

    if (!accessResult.ok || !accessResult.siteId) {
      return Response.json({ error: accessResult.error }, { status: accessResult.status });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const boardsResult = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, is_active, sort_order, markdown_status, site_id')
      .eq('site_id', accessResult.siteId)
      .order('sort_order', { ascending: true });

    if (boardsResult.error) {
      return Response.json({ error: '게시판 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      boards: boardsResult.data ?? [],
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시판 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시판 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
