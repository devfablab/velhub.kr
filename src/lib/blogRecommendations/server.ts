import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

const MAX_RECOMMENDED_POSTS = 20;

type RecommendedPostRow = {
  id: string;
  slug: string;
  subject: string;
  summary: string | null;
  thumbnail_image: string | null;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
  published_at: string | null;
  user_id: string;
  recommend_sort_order: number;
};

export type BlogRecommendationContext = {
  siteId: string;
  siteName: string;
  blogBoardId: string;
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
};

function toRecommendedPost(row: RecommendedPostRow) {
  return {
    id: row.id,
    slug: row.slug,
    subject: row.subject,
    summary: row.summary,
    thumbnailImage: row.thumbnail_image,
    thumbnailWidth: row.thumbnail_width,
    thumbnailHeight: row.thumbnail_height,
    publishedAt: row.published_at,
    userId: row.user_id,
    sortOrder: row.recommend_sort_order,
  };
}

export async function getBlogRecommendationContext(siteName: string): Promise<BlogRecommendationContext> {
  const normalizedSiteName = normalizeText(siteName).toLowerCase();

  if (!normalizedSiteName) {
    throw new Error('siteName이 유효하지 않습니다.');
  }

  const supabaseAdmin = getSupabaseAdmin();
  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_type')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (siteResult.error) {
    throw new Error('블로그를 확인하지 못했습니다.');
  }

  if (!siteResult.data || siteResult.data.site_type !== 'blog') {
    throw new Error('블로그를 찾을 수 없습니다.');
  }

  const session = await verifySession({ siteId: siteResult.data.id });

  if (session.case !== 'admin' && session.case !== 'staff') {
    throw new Error('접근 권한이 없습니다.');
  }

  const boardResult = await supabaseAdmin
    .from('boards')
    .select('id')
    .eq('site_id', siteResult.data.id)
    .eq('board_key', 'b')
    .eq('board_type', 'blog')
    .maybeSingle();

  if (boardResult.error) {
    throw new Error('블로그 게시판을 확인하지 못했습니다.');
  }

  if (!boardResult.data) {
    throw new Error('블로그 게시판을 찾을 수 없습니다.');
  }

  return {
    siteId: siteResult.data.id,
    siteName: siteResult.data.site_key,
    blogBoardId: boardResult.data.id,
    supabaseAdmin,
  };
}

export async function getRecommendedBlogPosts(context: BlogRecommendationContext) {
  const result = await context.supabaseAdmin
    .from('posts')
    .select(
      'id, slug, subject, summary, thumbnail_image, thumbnail_width, thumbnail_height, published_at, user_id, recommend_sort_order',
    )
    .eq('site_id', context.siteId)
    .eq('board_id', context.blogBoardId)
    .eq('is_recommended', true)
    .order('recommend_sort_order', { ascending: true });

  if (result.error) {
    throw new Error('추천 게시물을 불러오지 못했습니다.');
  }

  return ((result.data ?? []) as RecommendedPostRow[]).map(toRecommendedPost);
}

export async function searchRecommendedBlogPosts(context: BlogRecommendationContext, keyword: string) {
  const normalizedKeyword = normalizeText(keyword);

  if (!normalizedKeyword) {
    return [];
  }

  const result = await context.supabaseAdmin
    .from('posts')
    .select('id, slug, subject, summary, thumbnail_image, thumbnail_width, thumbnail_height, published_at, user_id')
    .eq('site_id', context.siteId)
    .eq('board_id', context.blogBoardId)
    .eq('published_status', 'published')
    .eq('is_recommended', false)
    .or(`subject.ilike.%${normalizedKeyword}%,content_html.ilike.%${normalizedKeyword}%`)
    .order('published_at', { ascending: false })
    .limit(20);

  if (result.error) {
    throw new Error('게시물을 검색하지 못했습니다.');
  }

  return (result.data ?? []).map((post) => ({
    id: String(post.id),
    slug: String(post.slug),
    subject: String(post.subject),
    summary: post.summary ? String(post.summary) : null,
    thumbnailImage: post.thumbnail_image ? String(post.thumbnail_image) : null,
    thumbnailWidth: typeof post.thumbnail_width === 'number' ? post.thumbnail_width : null,
    thumbnailHeight: typeof post.thumbnail_height === 'number' ? post.thumbnail_height : null,
    publishedAt: post.published_at ? String(post.published_at) : null,
    userId: String(post.user_id),
    sortOrder: 0,
  }));
}

async function movePostsToTemporaryOrder(
  context: BlogRecommendationContext,
  posts: ReturnType<typeof toRecommendedPost>[],
) {
  if (posts.length === 0) {
    return;
  }

  const maxSortOrder = Math.max(...posts.map((post) => post.sortOrder));
  const temporaryStartOrder = maxSortOrder + posts.length + 1;

  for (const [index, post] of posts.entries()) {
    const result = await context.supabaseAdmin
      .from('posts')
      .update({ recommend_sort_order: temporaryStartOrder + index })
      .eq('id', post.id)
      .eq('site_id', context.siteId)
      .eq('is_recommended', true);

    if (result.error) {
      throw new Error('추천 게시물 순서를 변경하지 못했습니다.');
    }
  }
}

async function saveRecommendedPostOrder(
  context: BlogRecommendationContext,
  posts: ReturnType<typeof toRecommendedPost>[],
  orderedPostIds: string[],
  startOrder = 1,
) {
  await movePostsToTemporaryOrder(context, posts);

  for (const [index, postId] of orderedPostIds.entries()) {
    const result = await context.supabaseAdmin
      .from('posts')
      .update({ recommend_sort_order: startOrder + index })
      .eq('id', postId)
      .eq('site_id', context.siteId)
      .eq('is_recommended', true);

    if (result.error) {
      throw new Error('추천 게시물 순서를 저장하지 못했습니다.');
    }
  }
}

export async function addRecommendedBlogPost(context: BlogRecommendationContext, postId: string) {
  const normalizedPostId = normalizeText(postId);

  if (!normalizedPostId) {
    throw new Error('게시물이 유효하지 않습니다.');
  }

  const postResult = await context.supabaseAdmin
    .from('posts')
    .select('id, is_recommended')
    .eq('id', normalizedPostId)
    .eq('site_id', context.siteId)
    .eq('board_id', context.blogBoardId)
    .eq('published_status', 'published')
    .maybeSingle();

  if (postResult.error) {
    throw new Error('게시물을 확인하지 못했습니다.');
  }

  if (!postResult.data) {
    throw new Error('추천할 수 있는 공개 블로그 게시물을 찾을 수 없습니다.');
  }

  const currentPosts = await getRecommendedBlogPosts(context);

  if (postResult.data.is_recommended) {
    return currentPosts;
  }

  if (currentPosts.length >= MAX_RECOMMENDED_POSTS) {
    throw new Error('추천 게시물은 최대 20개까지 설정할 수 있습니다.');
  }

  await movePostsToTemporaryOrder(context, currentPosts);

  const addResult = await context.supabaseAdmin
    .from('posts')
    .update({ is_recommended: true, recommend_sort_order: 1 })
    .eq('id', normalizedPostId)
    .eq('site_id', context.siteId)
    .eq('board_id', context.blogBoardId)
    .eq('published_status', 'published');

  if (addResult.error) {
    throw new Error('추천 게시물을 추가하지 못했습니다.');
  }

  const postsAfterAdd = await getRecommendedBlogPosts(context);
  const existingPosts = postsAfterAdd.filter((post) => post.id !== normalizedPostId);
  await saveRecommendedPostOrder(
    context,
    existingPosts,
    existingPosts.map((post) => post.id),
    2,
  );

  return getRecommendedBlogPosts(context);
}

export async function removeRecommendedBlogPost(context: BlogRecommendationContext, postId: string) {
  const normalizedPostId = normalizeText(postId);

  if (!normalizedPostId) {
    throw new Error('게시물이 유효하지 않습니다.');
  }

  const currentPosts = await getRecommendedBlogPosts(context);
  const targetPost = currentPosts.find((post) => post.id === normalizedPostId);

  if (!targetPost) {
    throw new Error('추천 게시물을 찾을 수 없습니다.');
  }

  const removeResult = await context.supabaseAdmin
    .from('posts')
    .update({ is_recommended: false, recommend_sort_order: null })
    .eq('id', normalizedPostId)
    .eq('site_id', context.siteId)
    .eq('is_recommended', true);

  if (removeResult.error) {
    throw new Error('추천 게시물을 삭제하지 못했습니다.');
  }

  const remainingPosts = currentPosts.filter((post) => post.id !== normalizedPostId);
  await saveRecommendedPostOrder(
    context,
    remainingPosts,
    remainingPosts.map((post) => post.id),
  );

  return getRecommendedBlogPosts(context);
}

export async function reorderRecommendedBlogPosts(context: BlogRecommendationContext, postIds: string[]) {
  const currentPosts = await getRecommendedBlogPosts(context);
  const currentPostIds = new Set(currentPosts.map((post) => post.id));
  const normalizedPostIds = postIds.map((postId) => normalizeText(postId)).filter(Boolean);

  if (
    normalizedPostIds.length !== currentPosts.length ||
    new Set(normalizedPostIds).size !== normalizedPostIds.length ||
    normalizedPostIds.some((postId) => !currentPostIds.has(postId))
  ) {
    throw new Error('추천 게시물 순서가 유효하지 않습니다.');
  }

  await saveRecommendedPostOrder(context, currentPosts, normalizedPostIds);

  return getRecommendedBlogPosts(context);
}
