import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { normalizeText } from '@/lib/utils';

type SessionCase = 'guest' | 'member' | 'staff';
type PostListSort = 'latest' | 'post_count';

type GetPostListOptions = {
  siteId: string;
  siteKey: string;
  boardId?: string | null;
  page: number;
  size: number;
  filter: 'all' | 'deleted';
  sessionCase: SessionCase;
  authUserId: string | null;
  keyword?: string | null;
  sort?: PostListSort;
  includePin?: boolean;
  categoryId?: string | null;
};

type PostImage = {
  path: string;
  url: string;
  width: number | null;
  height: number | null;
};

type RawPostRow = {
  id: string;
  slug: number;
  subject: string;
  summary: string | null;
  content_html: string | null;
  content_markdown: string | null;
  content_simple: string | null;
  edited_at: string;
  created_at: string;
  idx: number;
  series_idx: number | null;
  board_id: string;
  site_id: string;
  user_id: string;
  is_closed: boolean;
  closed_by: string | null;
  closed_at: string | null;
  closed_message: string | null;
  prefix_id: string | null;
  series_id: string | null;
  poll: unknown;
  published_at: string | null;
  published_status: 'draft' | 'published' | 'unknown';
  post_count: number | null;
  is_pin: boolean;
  thumbnail_image: string | null;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
  images: unknown;
  youtube_id: string | null;
};

export type BoardListItem = {
  id: string;
  board_key: string;
  board_label: string;
};

export type PostListItem = {
  id: string;
  slug: string;
  subject: string;
  summary: string;
  content_simple: string | null;
  edited_at: string;
  created_at: string;
  idx: number;
  series_idx: number | null;
  board_id: string;
  site_id: string;
  user_id: string;
  author_name: string;
  is_closed: boolean;
  closed_by: string | null;
  closed_at: string | null;
  closed_message: string | null;
  closed_by_name: string;
  prefix_id: string | null;
  prefix_label: string | null;
  series_id: string | null;
  series_label: string | null;
  is_poll: boolean;
  comment_count: number;
  search_title_matched: boolean;
  search_content_matched: boolean;
  search_content: string;
  published_at: string | null;
  published_status: 'draft' | 'published' | 'unknown';
  post_count: number;
  is_pin: boolean;
  board_key: string;
  board_label: string;
  thumbnail_image_url: string | null;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
  images: PostImage[] | null;
  youtube_id: string | null;
};

export type GetPostListResult = {
  contents: PostListItem[];
  totalCount: number;
  totalPage: number;
};

const POST_SELECT =
  'id, slug, subject, summary, content_html, content_markdown, content_simple, edited_at, created_at, idx, series_idx, board_id, site_id, user_id, is_closed, closed_by, closed_at, closed_message, prefix_id, series_id, poll, published_at, published_status, post_count, is_pin, thumbnail_image, thumbnail_width, thumbnail_height, images, youtube_id';

function stripHtml(value: string | null) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  return normalizedValue
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSearchTargetContent(post: RawPostRow) {
  return [post.content_simple, post.content_markdown, post.summary, stripHtml(post.content_html)]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSearchSnippet(content: string, keyword: string) {
  const normalizedContent = normalizeText(content).replace(/\s+/g, ' ').trim();
  const normalizedKeyword = normalizeText(keyword);

  if (!normalizedContent || !normalizedKeyword) {
    return '';
  }

  const contentLowerCase = normalizedContent.toLowerCase();
  const keywordLowerCase = normalizedKeyword.toLowerCase();
  const matchedIndex = contentLowerCase.indexOf(keywordLowerCase);

  if (matchedIndex === -1) {
    return '';
  }

  const maxLength = 150;
  const halfLength = Math.floor((maxLength - normalizedKeyword.length) / 2);
  const startIndex = Math.max(0, matchedIndex - halfLength);
  const endIndex = Math.min(normalizedContent.length, startIndex + maxLength);
  const snippet = normalizedContent.slice(startIndex, endIndex);

  return `${startIndex > 0 ? '...' : ''}${snippet}${endIndex < normalizedContent.length ? '...' : ''}`;
}

type SupabaseFilterQuery = {
  or: (filters: string) => SupabaseFilterQuery;
};

function applySearchFilter<TQuery extends SupabaseFilterQuery>(query: TQuery, keyword: string): TQuery {
  return query.or(
    [
      `subject.ilike.%${keyword}%`,
      `summary.ilike.%${keyword}%`,
      `content_html.ilike.%${keyword}%`,
      `content_markdown.ilike.%${keyword}%`,
      `content_simple.ilike.%${keyword}%`,
    ].join(','),
  ) as TQuery;
}

function getPostImageUrl(path: string | null) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return null;
  }

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return null;
  }

  const bucket = normalizedPath.includes('/') ? 'post' : 'og-image';

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${normalizedPath}`;
}

function normalizePostImages(value: unknown): PostImage[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const images = value
    .map((item): PostImage | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const image = item as {
        path?: unknown;
        url?: unknown;
        width?: unknown;
        height?: unknown;
      };

      const path = typeof image.path === 'string' ? image.path : '';
      const url = typeof image.url === 'string' ? image.url : (getPostImageUrl(path) ?? '');

      if (!url) {
        return null;
      }

      return {
        path,
        url,
        width: typeof image.width === 'number' ? image.width : null,
        height: typeof image.height === 'number' ? image.height : null,
      };
    })
    .filter((item): item is PostImage => Boolean(item));

  return images.length > 0 ? images : null;
}

export async function getPostList({
  siteId,
  boardId = null,
  page,
  size,
  filter,
  sessionCase,
  authUserId,
  keyword = null,
  sort = 'latest',
  includePin = true,
}: GetPostListOptions): Promise<GetPostListResult> {
  const supabaseAdmin = getSupabaseAdmin();
  const isStaff = sessionCase === 'staff';
  const from = (page - 1) * size;
  const to = from + size - 1;
  const searchKeyword = normalizeText(keyword);
  const shouldUsePinnedPosts = filter === 'all' && sort === 'latest' && includePin;
  const isAllBoardList = !boardId;

  let pinnedPosts: RawPostRow[] = [];

  if (shouldUsePinnedPosts) {
    let pinnedQuery = supabaseAdmin
      .from('posts')
      .select(POST_SELECT)
      .eq('site_id', siteId)
      .eq('is_pin', true)
      .eq('is_closed', false)
      .eq('published_status', 'published');

    if (boardId) {
      pinnedQuery = pinnedQuery.eq('board_id', boardId).order('idx', { ascending: false });
    } else {
      pinnedQuery = pinnedQuery
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
    }

    if (searchKeyword) {
      pinnedQuery = applySearchFilter(pinnedQuery, searchKeyword);
    }

    const pinnedResult = await pinnedQuery;

    if (pinnedResult.error) {
      throw new Error('글 목록을 불러오지 못했습니다.');
    }

    pinnedPosts = (pinnedResult.data ?? []) as RawPostRow[];
  }

  let postsQuery = supabaseAdmin.from('posts').select(POST_SELECT, { count: 'exact' }).eq('site_id', siteId);

  if (boardId) {
    postsQuery = postsQuery.eq('board_id', boardId);
  }

  if (filter === 'deleted') {
    postsQuery = postsQuery.eq('is_closed', true).eq('published_status', 'published');
  } else {
    if (shouldUsePinnedPosts || !includePin) {
      postsQuery = postsQuery.eq('is_pin', false);
    }

    if (!isStaff) {
      postsQuery = postsQuery.eq('is_closed', false);
    } else if (authUserId) {
      postsQuery = postsQuery.or(`is_closed.eq.false,user_id.neq.${authUserId}`);
    }

    const nowIsoString = new Date().toISOString();

    if (authUserId) {
      postsQuery = postsQuery.or(
        [
          'published_status.eq.published',
          `and(published_status.eq.unknown,published_at.lte.${nowIsoString})`,
          `and(published_status.eq.draft,user_id.eq.${authUserId})`,
          `and(published_status.eq.unknown,user_id.eq.${authUserId})`,
        ].join(','),
      );
    } else {
      postsQuery = postsQuery.or(
        ['published_status.eq.published', `and(published_status.eq.unknown,published_at.lte.${nowIsoString})`].join(
          ',',
        ),
      );
    }
  }

  if (searchKeyword) {
    postsQuery = applySearchFilter(postsQuery, searchKeyword);
  }

  if (sort === 'post_count') {
    postsQuery = postsQuery.order('post_count', { ascending: false, nullsFirst: false }).order('created_at', {
      ascending: false,
    });
  } else if (isAllBoardList) {
    postsQuery = postsQuery
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
  } else {
    postsQuery = postsQuery.order('idx', { ascending: false });
  }

  postsQuery = postsQuery.range(from, to);

  const postsResult = await postsQuery;

  if (postsResult.error) {
    throw new Error('글 목록을 불러오지 못했습니다.');
  }

  const mergedPosts = [...pinnedPosts, ...((postsResult.data ?? []) as RawPostRow[])];

  const postIds = Array.from(new Set(mergedPosts.map((post) => post.id).filter(Boolean)));
  const boardIds = Array.from(new Set(mergedPosts.map((post) => post.board_id).filter(Boolean)));
  const userIds = Array.from(
    new Set(
      mergedPosts.flatMap((post) => [post.user_id, post.closed_by]).filter((value): value is string => Boolean(value)),
    ),
  );
  const prefixIds = Array.from(
    new Set(mergedPosts.map((post) => post.prefix_id).filter((value): value is string => Boolean(value))),
  );
  const seriesIds = Array.from(
    new Set(mergedPosts.map((post) => post.series_id).filter((value): value is string => Boolean(value))),
  );

  const boardsResult =
    boardIds.length > 0
      ? await supabaseAdmin.from('boards').select('id, board_key, board_label').eq('site_id', siteId).in('id', boardIds)
      : { data: [], error: null };

  if (boardsResult.error) {
    throw new Error('글 목록을 불러오지 못했습니다.');
  }

  const rhizomeStigmasResult =
    userIds.length > 0
      ? await supabaseAdmin
          .from('rhizome_stigmas')
          .select('user_id, nickname')
          .eq('site_id', siteId)
          .in('user_id', userIds)
      : { data: [], error: null };

  if (rhizomeStigmasResult.error) {
    throw new Error('글 목록을 불러오지 못했습니다.');
  }

  const stigmaResult =
    userIds.length > 0
      ? await supabaseAdmin.from('stigmas').select('user_id, user_name').in('user_id', userIds)
      : { data: [], error: null };

  if (stigmaResult.error) {
    throw new Error('글 목록을 불러오지 못했습니다.');
  }

  const prefixResult =
    prefixIds.length > 0
      ? await supabaseAdmin.from('board_prefixes').select('id, prefix_label').in('id', prefixIds)
      : { data: [], error: null };

  if (prefixResult.error) {
    throw new Error('글 목록을 불러오지 못했습니다.');
  }

  const seriesResult =
    seriesIds.length > 0
      ? await supabaseAdmin.from('board_series').select('id, series_label').in('id', seriesIds)
      : { data: [], error: null };

  if (seriesResult.error) {
    throw new Error('글 목록을 불러오지 못했습니다.');
  }

  const commentResult =
    postIds.length > 0
      ? await supabaseAdmin.from('post_comments').select('post_id').eq('is_deleted', false).in('post_id', postIds)
      : { data: [], error: null };

  if (commentResult.error) {
    throw new Error('글 목록을 불러오지 못했습니다.');
  }

  const boardMap = new Map(
    (boardsResult.data ?? []).map((row) => [
      row.id as string,
      {
        board_key: normalizeText(row.board_key),
        board_label: normalizeText(row.board_label),
      },
    ]),
  );

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

  const prefixMap = new Map(
    (prefixResult.data ?? []).map((row) => [row.id as string, normalizeText(row.prefix_label)]),
  );

  const seriesMap = new Map(
    (seriesResult.data ?? []).map((row) => [row.id as string, normalizeText(row.series_label)]),
  );

  const commentCountMap = new Map<string, number>();

  (commentResult.data ?? []).forEach((row) => {
    const targetPostId = normalizeText(row.post_id);

    if (!targetPostId) {
      return;
    }

    commentCountMap.set(targetPostId, (commentCountMap.get(targetPostId) ?? 0) + 1);
  });

  const contents: PostListItem[] = mergedPosts.map((post) => {
    const boardInfo = boardMap.get(post.board_id);
    const searchTargetContent = getSearchTargetContent(post);
    const searchContent = searchKeyword ? getSearchSnippet(searchTargetContent, searchKeyword) : '';
    const searchTitleMatched = searchKeyword
      ? normalizeText(post.subject).toLowerCase().includes(searchKeyword.toLowerCase())
      : false;

    return {
      id: post.id,
      slug: String(post.slug),
      subject: post.subject,
      summary: post.summary ?? '',
      content_simple: post.content_simple,
      edited_at: post.edited_at,
      created_at: post.created_at,
      idx: post.idx,
      series_idx: post.series_idx,
      board_id: post.board_id,
      site_id: post.site_id,
      user_id: post.user_id,
      author_name: nicknameMap.get(post.user_id) || userNameMap.get(post.user_id) || '',
      is_closed: post.is_closed,
      closed_by: post.closed_by,
      closed_at: post.closed_at,
      closed_message: post.closed_message,
      closed_by_name: post.closed_by ? nicknameMap.get(post.closed_by) || userNameMap.get(post.closed_by) || '' : '',
      prefix_id: post.prefix_id,
      prefix_label: post.prefix_id ? (prefixMap.get(post.prefix_id) ?? null) : null,
      series_id: post.series_id,
      series_label: post.series_id ? (seriesMap.get(post.series_id) ?? null) : null,
      is_poll: Boolean(post.poll),
      comment_count: commentCountMap.get(post.id) ?? 0,
      search_title_matched: searchTitleMatched,
      search_content_matched: Boolean(searchContent),
      search_content: searchContent,
      published_at: post.published_at,
      published_status: post.published_status,
      post_count: typeof post.post_count === 'number' ? Number(post.post_count) : 0,
      is_pin: post.is_pin === true,
      board_key: boardInfo?.board_key ?? '',
      board_label: boardInfo?.board_label ?? '',
      thumbnail_image_url: getPostImageUrl(post.thumbnail_image),
      thumbnail_width: post.thumbnail_width,
      thumbnail_height: post.thumbnail_height,
      images: normalizePostImages(post.images),
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
