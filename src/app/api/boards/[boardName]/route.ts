import verifySession from '@/lib/session/verifySession';
import { decrypt } from '@/lib/encryption/decrypt';
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

type PageRow = {
  id: string;
  slug: string;
  subject: string;
  sort_order: number;
};

type PostImageRow = {
  path?: string | null;
  width?: number | null;
  height?: number | null;
};

type PostRow = {
  id: string;
  idx: number;
  series_idx: number | null;
  slug: number | string;
  subject: string | null;
  summary: string | null;
  content_simple: string | null;
  created_at: string;
  user_id: string;
  post_count: number | null;
  is_pin: boolean;
  board_id: string;
  prefix_id: string | null;
  series_id: string | null;
  poll: unknown;
  published_at: string | null;
  published_status: 'draft' | 'published';
  thumbnail_image: string | null;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
  images: unknown;
  youtube_id: string | null;
};

type StigmaRow = {
  id: string;
  user_id: string | null;
  user_name: string | null;
};

type MembershipRow = {
  user_id: string;
  nickname: string | null;
};

type PrefixRow = {
  id: string;
  prefix_label: string;
};

type CommentRow = {
  post_id: string;
};

type SeriesRow = {
  id: string;
  series_key: string;
  series_label: string;
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
    requestUrl.searchParams.has('keyword') ||
    requestUrl.searchParams.has('seriesName')
  );
}

function canWriteBlogPost(siteType: string, sessionCase: string) {
  return siteType === 'blog' && (sessionCase === 'member' || sessionCase === 'staff');
}

function getPublicPostImageUrl(path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return '';
  }

  const supabaseAdmin = getSupabaseAdmin();
  const bucket = normalizedPath.includes('/') ? 'post' : 'og-image';
  const publicUrl = supabaseAdmin.storage.from(bucket).getPublicUrl(normalizedPath);

  return publicUrl.data.publicUrl ?? '';
}

function normalizeImages(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return (value as PostImageRow[])
    .map((image) => {
      const path = normalizeText(image.path);

      if (!path) {
        return null;
      }

      return {
        path,
        url: getPublicPostImageUrl(path),
        width: typeof image.width === 'number' && Number.isFinite(image.width) ? Math.floor(image.width) : null,
        height: typeof image.height === 'number' && Number.isFinite(image.height) ? Math.floor(image.height) : null,
      };
    })
    .filter((image): image is { path: string; url: string; width: number | null; height: number | null } =>
      Boolean(image),
    );
}

async function getAuthorNameMap(siteId: string, userIds: string[]) {
  const supabaseAdmin = getSupabaseAdmin();
  const uniqueUserIds = Array.from(new Set(userIds.map((userId) => normalizeText(userId)).filter(Boolean)));
  const authorMap = new Map<string, string>();

  if (uniqueUserIds.length === 0) {
    return authorMap;
  }

  const [stigmasByIdResult, stigmasByAuthResult] = await Promise.all([
    supabaseAdmin.from('stigmas').select('id, user_id, user_name').in('id', uniqueUserIds),
    supabaseAdmin.from('stigmas').select('id, user_id, user_name').in('user_id', uniqueUserIds),
  ]);

  const stigmaRows = [
    ...((stigmasByIdResult.data ?? []) as StigmaRow[]),
    ...((stigmasByAuthResult.data ?? []) as StigmaRow[]),
  ];

  const stigmaIds = Array.from(new Set(stigmaRows.map((stigma) => stigma.id).filter(Boolean)));

  const membershipResult =
    stigmaIds.length > 0
      ? await supabaseAdmin
          .from('rhizome_stigmas')
          .select('user_id, nickname')
          .eq('site_id', siteId)
          .in('user_id', stigmaIds)
      : { data: [], error: null };

  const membershipMap = new Map(
    ((membershipResult.data ?? []) as MembershipRow[]).map((membership) => [
      membership.user_id,
      normalizeText(membership.nickname),
    ]),
  );

  uniqueUserIds.forEach((userId) => {
    const stigma = stigmaRows.find((row) => row.id === userId || row.user_id === userId);

    if (!stigma) {
      authorMap.set(userId, '');
      return;
    }

    const nickname = membershipMap.get(stigma.id);

    if (nickname) {
      authorMap.set(userId, nickname);
      return;
    }

    if (stigma.user_name) {
      try {
        authorMap.set(userId, decrypt(stigma.user_name));
      } catch {
        authorMap.set(userId, '');
      }
      return;
    }

    authorMap.set(userId, '');
  });

  return authorMap;
}

async function getSeriesFilteredPostList({
  siteId,
  board,
  page,
  size,
  filter,
  sessionCase,
  authUserId,
  keyword,
  sort,
  includePin,
  selectedSeries,
}: {
  siteId: string;
  board: BoardRow;
  page: number;
  size: number;
  filter: 'all' | 'deleted';
  sessionCase: 'staff' | 'member' | 'guest';
  authUserId: string | null;
  keyword: string;
  sort: 'latest' | 'post_count';
  includePin: boolean;
  selectedSeries: SeriesRow;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const from = (page - 1) * size;
  const to = from + size - 1;

  let postsQuery = supabaseAdmin
    .from('posts')
    .select(
      'id, idx, series_idx, slug, subject, summary, content_simple, created_at, user_id, post_count, is_pin, board_id, prefix_id, series_id, poll, published_at, published_status, thumbnail_image, thumbnail_width, thumbnail_height, images, youtube_id',
      { count: 'exact' },
    )
    .eq('site_id', siteId)
    .eq('board_id', board.id)
    .eq('series_id', selectedSeries.id);

  if (filter === 'deleted') {
    postsQuery = postsQuery.eq('is_closed', true);
  } else if (sessionCase === 'staff') {
    postsQuery = postsQuery.eq('is_closed', false);
  } else {
    postsQuery = postsQuery.eq('is_closed', false).eq('published_status', 'published');
  }

  if (keyword) {
    postsQuery = postsQuery.or(`subject.ilike.%${keyword}%,content_simple.ilike.%${keyword}%`);
  }

  if (includePin) {
    postsQuery = postsQuery.order('is_pin', { ascending: false });
  }

  if (sort === 'post_count') {
    postsQuery = postsQuery.order('post_count', { ascending: false });
  } else {
    postsQuery = postsQuery.order('series_idx', { ascending: true, nullsFirst: false }).order('published_at', {
      ascending: true,
      nullsFirst: false,
    });
  }

  const postsResult = await postsQuery.range(from, to);

  if (postsResult.error) {
    throw new Error('게시글 목록을 불러오지 못했습니다.');
  }

  const posts = (postsResult.data ?? []) as PostRow[];
  const postIds = posts.map((post) => post.id);
  const userIds = posts.map((post) => post.user_id).filter(Boolean);
  const prefixIds = Array.from(
    new Set(posts.map((post) => post.prefix_id).filter((value): value is string => Boolean(value))),
  );

  const [authorMap, commentResult, prefixResult] = await Promise.all([
    getAuthorNameMap(siteId, userIds),
    postIds.length > 0
      ? supabaseAdmin
          .from('post_comments')
          .select('post_id')
          .eq('site_id', siteId)
          .eq('board_id', board.id)
          .in('post_id', postIds)
          .eq('is_deleted', false)
          .eq('is_blinded', false)
      : { data: [], error: null },
    prefixIds.length > 0
      ? supabaseAdmin
          .from('board_prefixes')
          .select('id, prefix_label')
          .eq('site_id', siteId)
          .eq('board_id', board.id)
          .in('id', prefixIds)
      : { data: [], error: null },
  ]);

  if (commentResult.error || prefixResult.error) {
    throw new Error('게시글 목록을 불러오지 못했습니다.');
  }

  const commentCountMap = new Map<string, number>();

  ((commentResult.data ?? []) as CommentRow[]).forEach((comment) => {
    commentCountMap.set(comment.post_id, (commentCountMap.get(comment.post_id) ?? 0) + 1);
  });

  const prefixMap = new Map(
    ((prefixResult.data ?? []) as PrefixRow[]).map((prefix) => [prefix.id, normalizeText(prefix.prefix_label)]),
  );

  const contents = posts.map((post) => {
    const subject = normalizeText(post.subject);
    const contentSimple = normalizeText(post.content_simple);
    const searchTitleMatched = Boolean(keyword && subject.toLowerCase().includes(keyword.toLowerCase()));
    const searchContentMatched = Boolean(keyword && contentSimple.toLowerCase().includes(keyword.toLowerCase()));

    return {
      id: post.id,
      idx: post.idx,
      series_idx: post.series_idx,
      slug: String(post.slug),
      subject,
      summary: normalizeText(post.summary),
      content_simple: post.content_simple,
      created_at: post.created_at,
      author_name: authorMap.get(post.user_id) ?? '',
      post_count: Number(post.post_count ?? 0),
      is_pin: post.is_pin === true,
      board_key: board.board_key,
      board_label: board.board_label,
      prefix_label: post.prefix_id ? (prefixMap.get(post.prefix_id) ?? null) : null,
      series_key: selectedSeries.series_key,
      series_label: selectedSeries.series_label,
      is_poll: Boolean(post.poll),
      published_at: post.published_at,
      published_status: post.published_status,
      comment_count: commentCountMap.get(post.id) ?? 0,
      search_title_matched: searchTitleMatched,
      search_content_matched: searchContentMatched,
      search_content: searchContentMatched ? contentSimple : '',
      thumbnail_image_url: getPublicPostImageUrl(post.thumbnail_image) || null,
      thumbnail_width: post.thumbnail_width ?? 1200,
      thumbnail_height: post.thumbnail_height ?? 675,
      images: normalizeImages(post.images),
      youtube_id: post.youtube_id,
    };
  });

  const totalCount = postsResult.count ?? 0;
  const totalPage = Math.max(1, Math.ceil(totalCount / size));

  return {
    contents,
    totalCount,
    totalPage,
  };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { boardName } = await context.params;
    const requestUrl = new URL(request.url);

    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const seriesName = normalizeText(requestUrl.searchParams.get('seriesName')).toLowerCase();

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

    if (boardData.board_key === 'p' && boardData.board_type === 'page') {
      const pageResult = await supabaseAdmin
        .from('pages')
        .select('id, slug, subject, sort_order')
        .eq('site_id', rhizome.data.id)
        .order('sort_order', { ascending: true });

      if (pageResult.error) {
        return Response.json({ error: '페이지 목록을 불러오지 못했습니다.' }, { status: 500 });
      }

      return Response.json({
        board: boardData,
        pages: (pageResult.data ?? []) as PageRow[],
        actions: {
          canPinPost: false,
          canWritePost,
        },
        selectedSeries: null,
      });
    }

    let selectedSeries: SeriesRow | null = null;

    if (seriesName) {
      const seriesResult = await supabaseAdmin
        .from('board_series')
        .select('id, series_key, series_label')
        .eq('site_id', rhizome.data.id)
        .eq('board_id', boardData.id)
        .eq('series_key', seriesName)
        .maybeSingle();

      if (seriesResult.error || !seriesResult.data) {
        return Response.json({ error: '연재를 찾을 수 없습니다.' }, { status: 404 });
      }

      selectedSeries = seriesResult.data as SeriesRow;
    }

    if (!shouldLoadContents(requestUrl)) {
      return Response.json({
        board: boardData,
        actions: {
          canPinPost: session.case === 'staff',
          canWritePost,
        },
        selectedSeries: null,
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

    const result = selectedSeries
      ? await getSeriesFilteredPostList({
          siteId: rhizome.data.id,
          board: boardData,
          page,
          size,
          filter,
          sessionCase: postListSessionCase,
          authUserId: session.authUserId ?? null,
          keyword,
          sort,
          includePin,
          selectedSeries,
        })
      : await getPostList({
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

    const seriesLabels = Array.from(
      new Set(
        (result.contents ?? [])
          .map((content) => (typeof content.series_label === 'string' ? normalizeText(content.series_label) : ''))
          .filter(Boolean),
      ),
    );

    const seriesResult =
      !selectedSeries && seriesLabels.length > 0
        ? await supabaseAdmin
            .from('board_series')
            .select('series_key, series_label')
            .eq('site_id', rhizome.data.id)
            .eq('board_id', boardData.id)
            .in('series_label', seriesLabels)
        : { data: [], error: null };

    if (seriesResult.error) {
      return Response.json({ error: '연재 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const seriesKeyMap = new Map(
      (seriesResult.data ?? []).map((series) => [normalizeText(series.series_label), normalizeText(series.series_key)]),
    );

    const contents = (result.contents ?? []).map((content) => ({
      ...content,
      series_key: selectedSeries?.series_key ?? seriesKeyMap.get(normalizeText(content.series_label)) ?? null,
    }));

    return Response.json({
      board: boardData,
      actions: {
        canPinPost: session.case === 'staff',
        canWritePost,
      },
      selectedSeries: selectedSeries
        ? {
            series_key: selectedSeries.series_key,
            series_label: selectedSeries.series_label,
          }
        : null,
      contents,
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
