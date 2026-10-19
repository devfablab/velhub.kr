import { decrypt } from '@/lib/encryption/decrypt';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{ siteName: string }>;
};

type BlogPostRow = {
  id: string;
  slug: string;
  subject: string;
  summary: string | null;
  content_html: string | null;
  thumbnail_image: string | null;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
  published_at: string | null;
  post_count: number | null;
  user_id: string;
};

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

function getDisplayName(value: string | null) {
  if (!value) {
    return '';
  }

  try {
    return normalizeText(decrypt(value));
  } catch {
    return '';
  }
}

async function getPostAuthors(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, { name: string; avatarUrl: string | null }>();
  }

  const supabaseAdmin = getSupabaseAdmin();
  const result = await supabaseAdmin.from('stigmas').select('id, user_name, avatar').in('id', userIds);

  if (result.error) {
    throw new Error('작성자 정보를 불러오지 못했습니다.');
  }

  return new Map(
    (result.data ?? []).map((stigma) => [
      stigma.id,
      {
        name: getDisplayName(stigma.user_name),
        avatarUrl: stigma.avatar
          ? (supabaseAdmin.storage.from('avatar').getPublicUrl(stigma.avatar).data.publicUrl ?? null)
          : null,
      },
    ]),
  );
}

function toBlogPost(
  post: BlogPostRow,
  author: { name: string; avatarUrl: string | null } | undefined,
  likeCount: number,
) {
  return {
    id: post.id,
    slug: post.slug,
    subject: post.subject,
    summary: post.summary,
    contentHtml: post.content_html,
    thumbnailImageUrl: getPostImageUrl(post.thumbnail_image),
    thumbnailWidth: post.thumbnail_width,
    thumbnailHeight: post.thumbnail_height,
    publishedAt: post.published_at,
    postCount: Number(post.post_count ?? 0),
    likeCount,
    authorName: author?.name ?? '',
    authorAvatarUrl: author?.avatarUrl ?? null,
  };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { siteName } = await context.params;
    const normalizedSiteName = normalizeText(siteName).toLowerCase();

    if (!normalizedSiteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const siteResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_type, visibility_type, is_shutdown')
      .eq('site_key', normalizedSiteName)
      .maybeSingle();

    if (siteResult.error || !siteResult.data || siteResult.data.site_type !== 'blog') {
      return Response.json({ error: '블로그를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (siteResult.data.visibility_type !== 'public' || siteResult.data.is_shutdown) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const boardResult = await supabaseAdmin
      .from('boards')
      .select('id')
      .eq('site_id', siteResult.data.id)
      .eq('board_key', 'b')
      .eq('board_type', 'blog')
      .maybeSingle();

    if (boardResult.error || !boardResult.data) {
      return Response.json({ recommendedPosts: [], popularPosts: [], communityPosts: [] });
    }

    const siteId = siteResult.data.id;
    const boardId = boardResult.data.id;
    const postColumns =
      'id, slug, subject, summary, content_html, thumbnail_image, thumbnail_width, thumbnail_height, published_at, post_count, user_id';
    const createVisibleBlogPostsQuery = () =>
      supabaseAdmin
        .from('posts')
        .select(postColumns)
        .eq('site_id', siteId)
        .eq('board_id', boardId)
        .eq('is_closed', false)
        .eq('is_wording_blinded', false)
        .eq('published_status', 'published');

    const [recommendedResult, popularResult, communityEnabledResult] = await Promise.all([
      createVisibleBlogPostsQuery()
        .eq('is_recommended', true)
        .order('recommend_sort_order', { ascending: true })
        .limit(20),
      createVisibleBlogPostsQuery().order('post_count', { ascending: false, nullsFirst: false }),
      supabaseAdmin.from('blog_communities').select('is_enabled').eq('site_id', siteId).maybeSingle(),
    ]);

    if (recommendedResult.error || popularResult.error || communityEnabledResult.error) {
      throw new Error('블로그 홈 데이터를 불러오지 못했습니다.');
    }

    const recommendedRows = (recommendedResult.data ?? []) as BlogPostRow[];
    const popularRows = (popularResult.data ?? []) as BlogPostRow[];
    const popularPostIds = popularRows.map((post) => post.id);
    const likesResult = popularPostIds.length
      ? await supabaseAdmin.from('post_likes').select('post_id').in('post_id', popularPostIds)
      : { data: [], error: null };

    if (likesResult.error) {
      throw new Error('인기 게시물 정보를 불러오지 못했습니다.');
    }

    const likeCountMap = new Map<string, number>();
    for (const like of likesResult.data ?? []) {
      likeCountMap.set(like.post_id, (likeCountMap.get(like.post_id) ?? 0) + 1);
    }

    const popularPosts = [...popularRows]
      .sort(
        (left, right) =>
          Number(right.post_count ?? 0) - Number(left.post_count ?? 0) ||
          (likeCountMap.get(right.id) ?? 0) - (likeCountMap.get(left.id) ?? 0),
      )
      .slice(0, 30);
    const authorIds = [...new Set([...recommendedRows, ...popularPosts].map((post) => post.user_id))];
    const authors = await getPostAuthors(authorIds);
    const communityPosts = communityEnabledResult.data?.is_enabled ? await getBlogCommunityPosts(siteId) : [];

    return Response.json({
      recommendedPosts: recommendedRows.map((post) =>
        toBlogPost(post, authors.get(post.user_id), likeCountMap.get(post.id) ?? 0),
      ),
      popularPosts: popularPosts.map((post) =>
        toBlogPost(post, authors.get(post.user_id), likeCountMap.get(post.id) ?? 0),
      ),
      communityPosts,
    });
  } catch (unknownError) {
    return Response.json(
      { error: unknownError instanceof Error ? unknownError.message : '블로그 홈 데이터를 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}

async function getBlogCommunityPosts(siteId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const postsResult = await supabaseAdmin
    .from('blog_community_posts')
    .select('id, slug, user_id, content, created_at')
    .eq('site_id', siteId)
    .eq('is_deleted', false)
    .eq('is_wording_blinded', false)
    .order('created_at', { ascending: false })
    .limit(10);

  if (postsResult.error) {
    throw new Error('블로그 커뮤니티 글을 불러오지 못했습니다.');
  }

  const posts = postsResult.data ?? [];
  const postIds = posts.map((post) => post.id);
  const userIds = [...new Set(posts.map((post) => post.user_id))];
  const [authors, imagesResult, commentsResult] = await Promise.all([
    getPostAuthors(userIds),
    postIds.length
      ? supabaseAdmin
          .from('blog_community_post_images')
          .select('post_id, image_url, sort_order')
          .in('post_id', postIds)
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    postIds.length
      ? supabaseAdmin.from('blog_community_comments').select('post_id').eq('is_deleted', false).in('post_id', postIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (imagesResult.error || commentsResult.error) {
    throw new Error('블로그 커뮤니티 글을 불러오지 못했습니다.');
  }

  const imageMap = new Map<string, string[]>();
  for (const image of imagesResult.data ?? []) {
    const images = imageMap.get(image.post_id) ?? [];
    images.push(image.image_url);
    imageMap.set(image.post_id, images);
  }

  const commentCountMap = new Map<string, number>();
  for (const comment of commentsResult.data ?? []) {
    commentCountMap.set(comment.post_id, (commentCountMap.get(comment.post_id) ?? 0) + 1);
  }

  return posts.map((post) => ({
    id: post.id,
    slug: String(post.slug),
    content: post.content,
    createdAt: post.created_at,
    authorName: authors.get(post.user_id)?.name ?? '',
    authorAvatarUrl: authors.get(post.user_id)?.avatarUrl ?? null,
    images: imageMap.get(post.id) ?? [],
    commentCount: commentCountMap.get(post.id) ?? 0,
  }));
}
