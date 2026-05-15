import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { getPostList } from '@/lib/board/getPostList';

type RouteContext = {
  params: Promise<{
    boardName: string;
  }>;
};

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: 'basic' | 'gallery' | 'youtube' | 'feed' | 'page' | 'blog';
  markdown_status: string | null;
  site_id: string;
  post_type: 'none' | 'prefix' | 'series' | null;
  is_active: boolean;
  write_permission: 'member' | 'manager' | 'community-manager' | 'owner' | null;
  post_per_page: number | null;
};

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

function shouldLoadContents(requestUrl: URL) {
  return (
    requestUrl.searchParams.has('page') ||
    requestUrl.searchParams.has('size') ||
    requestUrl.searchParams.has('sort') ||
    requestUrl.searchParams.has('includePin') ||
    requestUrl.searchParams.has('filter') ||
    requestUrl.searchParams.has('keyword')
  );
}

function canWriteBlogPost(siteType: string, sessionCase: string) {
  return siteType === 'blog' && (sessionCase === 'member' || sessionCase === 'staff');
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { boardName } = await context.params;
    const requestUrl = new URL(request.url);

    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const normalizedBoardName = normalizeText(boardName).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_type, visibility_type, is_shutdown')
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

    const board = await supabaseAdmin
      .from('boards')
      .select(
        'id, board_key, board_label, board_type, markdown_status, site_id, post_type, is_active, write_permission, post_per_page',
      )
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    const boardData = board.data as BoardRow;
    const canWritePost = canWriteBlogPost(rhizome.data.site_type, session.case);

    if (!shouldLoadContents(requestUrl)) {
      return Response.json({
        board: boardData,
        actions: {
          canPinPost: session.case === 'staff',
          canWritePost,
        },
      });
    }

    const page = parsePositiveInt(requestUrl.searchParams.get('page'), 1);
    const size = parsePositiveInt(requestUrl.searchParams.get('size'), 10);
    const filter = normalizeText(requestUrl.searchParams.get('filter')).toLowerCase() === 'deleted' ? 'deleted' : 'all';
    const keyword = normalizeText(requestUrl.searchParams.get('keyword'));
    const sort = normalizeSort(requestUrl.searchParams.get('sort'));
    const includePin = parseIncludePin(requestUrl.searchParams.get('includePin'));

    const postListSessionCase =
      session.case === 'admin' || session.case === 'staff' ? 'staff' : session.case === 'member' ? 'member' : 'guest';

    const result = await getPostList({
      siteId: rhizome.data.id,
      siteKey: siteName,
      boardId: boardData.id,
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
      board: boardData,
      actions: {
        canPinPost: session.case === 'staff',
        canWritePost,
      },
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
      return Response.json({ error: unknownError.message || '게시판 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시판 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
