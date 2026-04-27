import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
  }>;
};

type PostListRow = {
  id: string;
  slug: number;
  subject: string;
  summary: string | null;
  edited_at: string;
  created_at: string;
  idx: number;
  board_id: string;
  site_id: string;
  user_id: string;
  is_closed: boolean;
  closed_by: string | null;
  closed_at: string | null;
  closed_message: string | null;
  prefix_id: string | null;
  published_status: 'draft' | 'published';
  post_count: number | null;
  is_pin: boolean;
};

function parsePositiveInt(value: string | null, fallbackValue: number) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallbackValue;
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

    const isStaff = session.case === 'staff';
    const authUserId = session.authUserId ?? null;

    if (rhizome.data.visibility_type !== 'public' || rhizome.data.is_shutdown !== false) {
      if (!isStaff) {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, created_at, post_per_page, post_type')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (board.data.board_type === 'page') {
      const from = (page - 1) * size;
      const to = from + size - 1;

      const pageQuery = supabaseAdmin
        .from('pages')
        .select(
          'id, slug, subject, summary, edited_at, sort_order, user_id, board_id, site_id, created_at, og_image, og_image_url, attachment_slug, attachment_origin, is_comment',
          { count: 'exact' },
        )
        .eq('board_id', board.data.id)
        .order('sort_order', { ascending: true })
        .range(from, to);

      const pagesResult = await pageQuery;

      if (pagesResult.error) {
        return Response.json({ error: '페이지 목록을 불러오지 못했습니다.' }, { status: 500 });
      }

      const userIds = Array.from(
        new Set(
          (pagesResult.data ?? []).map((pageRow) => pageRow.user_id).filter((value): value is string => Boolean(value)),
        ),
      );

      const rhizomeStigmasResult =
        userIds.length > 0
          ? await supabaseAdmin
              .from('rhizome_stigmas')
              .select('user_id, nickname')
              .eq('site_id', rhizome.data.id)
              .in('user_id', userIds)
          : { data: [], error: null };

      if (rhizomeStigmasResult.error) {
        return Response.json({ error: '페이지 목록을 불러오지 못했습니다.' }, { status: 500 });
      }

      const stigmaResult =
        userIds.length > 0
          ? await supabaseAdmin.from('stigmas').select('user_id, user_name').in('user_id', userIds)
          : { data: [], error: null };

      if (stigmaResult.error) {
        return Response.json({ error: '페이지 목록을 불러오지 못했습니다.' }, { status: 500 });
      }

      const nicknameMap = new Map(
        (rhizomeStigmasResult.data ?? []).map((row) => [row.user_id as string, normalizeText(row.nickname)]),
      );

      const userNameMap = new Map(
        (stigmaResult.data ?? []).map((row) => {
          let decryptedUserName = '';
          try {
            decryptedUserName = row.user_name ? decrypt(row.user_name as string) : '';
          } catch {
            decryptedUserName = '';
          }
          return [row.user_id as string, decryptedUserName];
        }),
      );

      const contents = (pagesResult.data ?? []).map((pageRow) => ({
        ...pageRow,
        author_name: nicknameMap.get(pageRow.user_id as string) || userNameMap.get(pageRow.user_id as string) || '',
        is_closed: false,
        closed_by: null,
        closed_at: null,
        closed_message: null,
        closed_by_name: '',
        prefix_id: null,
        prefix_label: null,
        post_count: null,
        is_pin: false,
      }));

      const totalCount = pagesResult.count ?? 0;
      const totalPage = Math.max(1, Math.ceil(totalCount / size));

      return Response.json({
        board: board.data,
        contents,
        page,
        size,
        totalCount,
        totalPage,
        filter,
      });
    }

    const from = (page - 1) * size;
    const to = from + size - 1;

    let pinnedPosts: PostListRow[] = [];

    if (filter === 'all') {
      const pinnedQuery = supabaseAdmin
        .from('posts')
        .select(
          'id, slug, subject, summary, edited_at, created_at, idx, board_id, site_id, user_id, is_closed, closed_by, closed_at, closed_message, prefix_id, published_status, post_count, is_pin',
        )
        .eq('board_id', board.data.id)
        .eq('is_pin', true)
        .eq('is_closed', false)
        .eq('published_status', 'published')
        .order('idx', { ascending: false });

      const pinnedResult = await pinnedQuery;

      if (pinnedResult.error) {
        return Response.json({ error: '글 목록을 불러오지 못했습니다.' }, { status: 500 });
      }

      pinnedPosts = (pinnedResult.data ?? []) as PostListRow[];
    }

    const postsQuery = supabaseAdmin
      .from('posts')
      .select(
        'id, slug, subject, summary, edited_at, created_at, idx, board_id, site_id, user_id, is_closed, closed_by, closed_at, closed_message, prefix_id, published_status, post_count, is_pin',
        { count: 'exact' },
      )
      .eq('board_id', board.data.id)
      .order('idx', { ascending: false });

    if (filter === 'deleted') {
      postsQuery.eq('is_closed', true).eq('published_status', 'published');
    } else {
      postsQuery.eq('is_pin', false);

      if (!isStaff) {
        postsQuery.eq('is_closed', false);
      }

      if (authUserId) {
        postsQuery.or(`published_status.eq.published,and(published_status.eq.draft,user_id.eq.${authUserId})`);
      } else {
        postsQuery.eq('published_status', 'published');
      }
    }

    postsQuery.range(from, to);

    const postsResult = await postsQuery;

    if (postsResult.error) {
      return Response.json({ error: '글 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const mergedPosts = [...pinnedPosts, ...((postsResult.data ?? []) as PostListRow[])];

    const userIds = Array.from(
      new Set(
        mergedPosts
          .flatMap((post) => [post.user_id, post.closed_by])
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const prefixIds = Array.from(
      new Set(mergedPosts.map((post) => post.prefix_id).filter((value): value is string => Boolean(value))),
    );

    const rhizomeStigmasResult =
      userIds.length > 0
        ? await supabaseAdmin
            .from('rhizome_stigmas')
            .select('user_id, nickname')
            .eq('site_id', rhizome.data.id)
            .in('user_id', userIds)
        : { data: [], error: null };

    if (rhizomeStigmasResult.error) {
      return Response.json({ error: '글 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const stigmaResult =
      userIds.length > 0
        ? await supabaseAdmin.from('stigmas').select('user_id, user_name').in('user_id', userIds)
        : { data: [], error: null };

    if (stigmaResult.error) {
      return Response.json({ error: '글 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const prefixResult =
      prefixIds.length > 0
        ? await supabaseAdmin
            .from('board_prefixes')
            .select('id, prefix_label')
            .eq('board_id', board.data.id)
            .in('id', prefixIds)
        : { data: [], error: null };

    if (prefixResult.error) {
      return Response.json({ error: '글 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const nicknameMap = new Map(
      (rhizomeStigmasResult.data ?? []).map((row) => [row.user_id as string, normalizeText(row.nickname)]),
    );

    const userNameMap = new Map(
      (stigmaResult.data ?? []).map((row) => {
        let decryptedUserName = '';
        try {
          decryptedUserName = row.user_name ? decrypt(row.user_name as string) : '';
        } catch {
          decryptedUserName = '';
        }
        return [row.user_id as string, decryptedUserName];
      }),
    );

    const prefixMap = new Map((prefixResult.data ?? []).map((row) => [row.id as string, row.prefix_label as string]));

    const contents = mergedPosts.map((post) => ({
      ...post,
      author_name: nicknameMap.get(post.user_id as string) || userNameMap.get(post.user_id as string) || '',
      closed_by_name: post.closed_by ? nicknameMap.get(post.closed_by) || userNameMap.get(post.closed_by) || '' : '',
      prefix_label: post.prefix_id ? (prefixMap.get(post.prefix_id) ?? null) : null,
    }));

    const totalCount = postsResult.count ?? 0;
    const totalPage = Math.max(1, Math.ceil(totalCount / size));

    return Response.json({
      board: board.data,
      contents,
      page,
      size,
      totalCount,
      totalPage,
      filter,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시판을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시판을 불러오지 못했습니다.' }, { status: 500 });
  }
}
