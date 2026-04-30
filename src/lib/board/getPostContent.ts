import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { encrypt } from '@/lib/encryption/encrypt';
import { normalizeText } from '@/lib/utils';

type SessionCase = 'guest' | 'member' | 'staff';

type PostImageRow = {
  path?: string | null;
  width?: number | null;
  height?: number | null;
};

type GetPostContentOptions = {
  siteId: string;
  siteKey: string;
  boardId: string;
  boardKey: string;
  postType: 'none' | 'prefix' | 'series' | null;
  contentId: string;
  countView: boolean;
  sessionCase: SessionCase;
  authUserId: string | null;
  requestCookie: string | null;
};

export class BoardContentError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'BoardContentError';
    this.status = status;
  }
}

function isNumericSlug(value: string) {
  return /^\d+$/.test(value);
}

function getPublicPostImageUrl(path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return '';
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from('post').getPublicUrl(normalizedPath);

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
    .filter(Boolean);
}

function getPostViewCookieName(siteKey: string, boardKey: string, idx: number) {
  return `PS_${encrypt(siteKey)}_${encrypt(boardKey)}_${encrypt(String(idx))}`;
}

async function getUserDisplayName(siteId: string, userId: string | null | undefined) {
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    return '';
  }

  const supabaseAdmin = getSupabaseAdmin();

  const nicknameResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('nickname')
    .eq('site_id', siteId)
    .eq('user_id', normalizedUserId)
    .maybeSingle();

  if (!nicknameResult.error && nicknameResult.data?.nickname) {
    return normalizeText(nicknameResult.data.nickname);
  }

  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('user_name')
    .eq('user_id', normalizedUserId)
    .maybeSingle();

  if (!stigmaResult.error && stigmaResult.data?.user_name) {
    try {
      return decrypt(stigmaResult.data.user_name as string);
    } catch {
      return '';
    }
  }

  return '';
}

export async function getPostContent({
  siteId,
  siteKey,
  boardId,
  boardKey,
  postType,
  contentId,
  countView,
  sessionCase,
  authUserId,
  requestCookie,
}: GetPostContentOptions) {
  const supabaseAdmin = getSupabaseAdmin();
  const normalizedContentId = normalizeText(contentId);
  const isStaff = sessionCase === 'staff';

  if (!normalizedContentId) {
    throw new BoardContentError('contentId가 유효하지 않습니다.', 400);
  }

  const postQuery = supabaseAdmin
    .from('posts')
    .select(
      'id, slug, subject, summary, content_html, content_markdown, content_simple, edited_at, thumbnail_image, thumbnail_width, thumbnail_height, youtube_url, youtube_id, youtube_created_at, images, poll, hashtags, idx, user_id, site_id, board_id, created_at, is_closed, closed_by, closed_at, closed_message, categories, series_id, prefix_id, published_status, published_at, is_comment, post_count, is_pin',
    )
    .eq('site_id', siteId)
    .eq('board_id', boardId);

  const post = isNumericSlug(normalizedContentId)
    ? await postQuery.eq('slug', Number(normalizedContentId)).maybeSingle()
    : await postQuery.eq('id', normalizedContentId).maybeSingle();

  if (post.error || !post.data) {
    throw new BoardContentError('글을 찾을 수 없습니다.', 404);
  }

  const isAuthor = Boolean(authUserId) && post.data.user_id === authUserId;

  if (post.data.published_status === 'draft' && !isAuthor) {
    throw new BoardContentError('접근 권한이 없습니다.', 403);
  }

  if (post.data.is_closed === true && !isStaff) {
    throw new BoardContentError('접근 권한이 없습니다.', 403);
  }

  const authorName = await getUserDisplayName(siteId, post.data.user_id);
  const closedByName = await getUserDisplayName(siteId, post.data.closed_by);

  const categoryIds = Array.isArray(post.data.categories)
    ? post.data.categories.filter((value: unknown): value is string => typeof value === 'string' && Boolean(value))
    : [];

  let categories: Array<{
    id: string;
    category_key: string;
    category_label: string;
    summary: string | null;
    thumbnail_image: string | null;
    sort_order: number;
    board_id: string;
    site_id: string;
    created_at?: string;
  }> = [];

  if (categoryIds.length > 0) {
    const categoryResult = await supabaseAdmin
      .from('board_categories')
      .select('id, category_key, category_label, summary, thumbnail_image, sort_order, board_id, site_id, created_at')
      .eq('site_id', siteId)
      .eq('board_id', boardId)
      .in('id', categoryIds)
      .order('sort_order', { ascending: true });

    if (categoryResult.error) {
      throw new BoardContentError('카테고리 정보를 불러오지 못했습니다.', 500);
    }

    categories = categoryResult.data ?? [];
  }

  let series: {
    id: string;
    created_at: string;
    series_key: string;
    series_label: string;
    summary: string | null;
    thumbnail_image: string | null;
    board_id: string;
    site_id: string;
    last_published_at: string | null;
    is_completed: boolean;
    user_id: string | null;
  } | null = null;

  if (post.data.series_id) {
    const seriesResult = await supabaseAdmin
      .from('board_series')
      .select(
        'id, created_at, series_key, series_label, summary, thumbnail_image, board_id, site_id, last_published_at, is_completed, user_id',
      )
      .eq('site_id', siteId)
      .eq('board_id', boardId)
      .eq('id', post.data.series_id)
      .maybeSingle();

    if (seriesResult.error) {
      throw new BoardContentError('연재 정보를 불러오지 못했습니다.', 500);
    }

    series = seriesResult.data ?? null;
  }

  let prefixes: Array<{ id: string; prefix_label: string }> = [];
  let prefixLabel: string | null = null;

  if (postType === 'prefix') {
    const prefixResult = await supabaseAdmin
      .from('board_prefixes')
      .select('id, prefix_label')
      .eq('site_id', siteId)
      .eq('board_id', boardId)
      .order('prefix_key', { ascending: true });

    if (prefixResult.error) {
      throw new BoardContentError('말머리 정보를 불러오지 못했습니다.', 500);
    }

    const postData = post.data;
    prefixes = prefixResult.data ?? [];
    prefixLabel = prefixes.find((prefix) => prefix.id === postData.prefix_id)?.prefix_label ?? null;
  }

  let postCount = typeof post.data.post_count === 'number' ? Number(post.data.post_count) : 0;
  let viewCookie: {
    name: string;
    value: string;
    maxAge: number;
  } | null = null;

  if (
    countView &&
    !isAuthor &&
    !post.data.is_closed &&
    post.data.published_status === 'published' &&
    typeof post.data.idx === 'number'
  ) {
    const viewCookieName = getPostViewCookieName(siteKey, boardKey, Number(post.data.idx));
    const alreadyViewed = requestCookie
      ?.split(';')
      .map((item) => item.trim())
      .some((item) => item.startsWith(`${viewCookieName}=`));

    if (!alreadyViewed) {
      const updateViewResult = await supabaseAdmin
        .from('posts')
        .update({
          post_count: postCount + 1,
        })
        .eq('id', post.data.id)
        .eq('post_count', postCount)
        .select('post_count')
        .maybeSingle();

      if (!updateViewResult.error && updateViewResult.data) {
        postCount = Number(updateViewResult.data.post_count ?? postCount + 1);
        viewCookie = {
          name: viewCookieName,
          value: '1',
          maxAge: 60 * 60 * 24,
        };
      }
    }
  }

  return {
    content: {
      ...post.data,
      slug: String(post.data.slug),
      author_name: authorName,
      closed_by_name: closedByName,
      prefix_label: prefixLabel,
      thumbnail_image_url: getPublicPostImageUrl(post.data.thumbnail_image),
      images: normalizeImages(post.data.images),
      post_count: postCount,
    },
    categories,
    series,
    prefixes,
    isAuthor,
    isStaff,
    viewCookie,
  };
}
