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

function normalizeSort(value: string | null) {
  const sort = normalizeText(value).toLowerCase();

  if (sort === 'post_count') {
    return 'post_count';
  }

  return 'latest';
}

function parseIncludePin(value: string | null) {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (normalizedValue === 'false') {
    return false;
  }

  return true;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const page = parsePositiveInt(requestUrl.searchParams.get('page'), 1);
    const size = parsePositiveInt(requestUrl.searchParams.get('size'), 10);
    const filter = normalizeText(requestUrl.searchParams.get('filter')).toLowerCase() === 'deleted' ? 'deleted' : 'all';
    const keyword = normalizeText(requestUrl.searchParams.get('keyword'));
    const sort = normalizeSort(requestUrl.searchParams.get('sort'));
    const includePin = parseIncludePin(requestUrl.searchParams.get('includePin'));

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

    const isAuth = session.case === 'admin' || session.case === 'staff' || session.case === 'member';

    if (rhizome.data.visibility_type !== 'public' || rhizome.data.is_shutdown !== false) {
      if (!isAuth) {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const postListSessionCase =
      session.case === 'admin' || session.case === 'staff' ? 'staff' : session.case === 'member' ? 'member' : 'guest';

    const result = await getPostList({
      siteId: rhizome.data.id,
      siteKey: siteName,
      boardId: null,
      page,
      size,
      filter,
      sessionCase: postListSessionCase,
      authUserId: session.authUserId ?? null,
      keyword,
      sort,
      includePin,
    });

    return Response.json({
      contents: result.contents,
      page,
      size,
      totalCount: result.totalCount,
      totalPage: result.totalPage,
      filter,
      keyword,
      sort,
      includePin,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '전체 게시글을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '전체 게시글을 불러오지 못했습니다.' }, { status: 500 });
  }
}
