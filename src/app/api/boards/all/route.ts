import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { getPostList } from '@/lib/board/getPostList';

function parsePositiveInt(value: string | null, fallbackValue: number) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallbackValue;
  }

  return Math.floor(parsedValue);
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const page = parsePositiveInt(requestUrl.searchParams.get('page'), 1);
    const size = parsePositiveInt(requestUrl.searchParams.get('size'), 10);
    const filter = normalizeText(requestUrl.searchParams.get('filter')).toLowerCase() === 'deleted' ? 'deleted' : 'all';

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

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (rhizome.data.visibility_type !== 'public' || rhizome.data.is_shutdown !== false) {
      if (session.case !== 'staff') {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const result = await getPostList({
      siteId: rhizome.data.id,
      siteKey: siteName,
      boardId: null,
      page,
      size,
      filter,
      sessionCase: session.case,
      authUserId: session.authUserId ?? null,
    });

    return Response.json({
      contents: result.contents,
      page,
      size,
      totalCount: result.totalCount,
      totalPage: result.totalPage,
      filter,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '전체 게시글을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '전체 게시글을 불러오지 못했습니다.' }, { status: 500 });
  }
}
