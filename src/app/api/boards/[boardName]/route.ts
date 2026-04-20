import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
  }>;
};

type PostRow = {
  id: string;
  slug: number;
  subject: string;
  summary: string | null;
  edited_at: string;
  thumbnail_image: string | null;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
  idx: number;
  user_id: string;
  site_id: string;
  board_id: string;
  created_at: string;
  is_closed?: boolean | null;
  closed_by?: string | null;
  closed_at?: string | null;
  closed_message?: string | null;
};

function parsePage(value: string | null) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return 1;
  }

  return Math.floor(parsedValue);
}

function parseSize(value: string | null, fallbackValue: number) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallbackValue;
  }

  if (parsedValue < 5) {
    return 5;
  }

  if (parsedValue > 50) {
    return 50;
  }

  return Math.floor(parsedValue);
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { boardName } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const page = parsePage(requestUrl.searchParams.get('page'));
    const filter = normalizeText(requestUrl.searchParams.get('filter')).toLowerCase();

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

    const isStaff = session.status !== 'FAIL' && session.case === 'staff';

    if (rhizome.data.visibility_type !== 'public' || rhizome.data.is_shutdown !== false) {
      if (!isStaff) {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const board = await supabaseAdmin
      .from('boards')
      .select(
        'id, board_key, board_label, board_type, is_active, sort_order, markdown_status, site_id, created_at, post_per_page, post_type',
      )
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    const defaultSize =
      typeof board.data.post_per_page === 'number' && Number.isFinite(board.data.post_per_page)
        ? Math.min(Math.max(Math.floor(board.data.post_per_page), 5), 50)
        : 5;

    const size = parseSize(requestUrl.searchParams.get('size'), defaultSize);
    const from = (page - 1) * size;
    const to = from + size - 1;

    if (board.data.board_type === 'page') {
      const pages = await supabaseAdmin
        .from('pages')
        .select('id, slug, subject, summary, edited_at, sort_order, user_id, site_id, board_id, created_at', {
          count: 'exact',
        })
        .eq('board_id', board.data.id)
        .order('sort_order', { ascending: true })
        .range(from, to);

      if (pages.error) {
        return Response.json({ error: '페이지 목록을 불러오지 못했습니다.' }, { status: 500 });
      }

      const totalCount = pages.count ?? 0;
      const totalPage = totalCount > 0 ? Math.ceil(totalCount / size) : 1;

      return Response.json({
        board: board.data,
        contents: pages.data ?? [],
        page,
        size,
        totalCount,
        totalPage,
      });
    }

    let postQuery = supabaseAdmin
      .from('posts')
      .select('*', { count: 'exact' })
      .eq('board_id', board.data.id)
      .order('created_at', { ascending: false });

    if (!isStaff) {
      postQuery = postQuery.neq('is_closed', true);
    } else if (filter === 'deleted') {
      postQuery = postQuery.eq('is_closed', true);
    }

    const posts = await postQuery.range(from, to);

    if (posts.error) {
      return Response.json({ error: '글 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const visiblePosts = (posts.data ?? []) as PostRow[];

    const userIdList = Array.from(
      new Set(
        visiblePosts
          .flatMap((post) => [post.user_id, post.closed_by])
          .filter((value): value is string => typeof value === 'string' && value.length > 0),
      ),
    );

    let nicknameMap = new Map<string, string>();
    let userNameMap = new Map<string, string>();

    if (userIdList.length > 0) {
      const nicknameList = await supabaseAdmin
        .from('rhizome_stigmas')
        .select('user_id, nickname')
        .eq('site_id', rhizome.data.id)
        .in('user_id', userIdList);

      if (!nicknameList.error) {
        nicknameMap = new Map(
          (nicknameList.data ?? [])
            .filter((item) => item.user_id)
            .map((item) => [item.user_id as string, (item.nickname as string | null) ?? '']),
        );
      }

      const stigmaList = await supabaseAdmin.from('stigmas').select('user_id, user_name').in('user_id', userIdList);

      if (!stigmaList.error) {
        userNameMap = new Map(
          (stigmaList.data ?? [])
            .filter((item) => item.user_id)
            .map((item) => {
              const encryptedUserName = (item.user_name as string | null) ?? '';
              return [item.user_id as string, encryptedUserName ? decrypt(encryptedUserName) : ''];
            }),
        );
      }
    }

    const totalCount = posts.count ?? 0;
    const totalPage = totalCount > 0 ? Math.ceil(totalCount / size) : 1;

    return Response.json({
      board: board.data,
      contents: visiblePosts.map((post) => ({
        ...post,
        slug: String(post.slug),
        author_name: nicknameMap.get(post.user_id) || userNameMap.get(post.user_id) || '',
        closed_by_name:
          post.closed_by && (nicknameMap.get(post.closed_by) || userNameMap.get(post.closed_by) || '')
            ? nicknameMap.get(post.closed_by) || userNameMap.get(post.closed_by) || ''
            : '',
      })),
      page,
      size,
      totalCount,
      totalPage,
      filter: isStaff && filter === 'deleted' ? 'deleted' : 'all',
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시판 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시판 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
