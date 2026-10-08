import sharp from 'sharp';
import {
  getBlogCommunityContext,
  getBlogCommunityEnablement,
  assertBlogCommunityUse,
} from '@/lib/blogCommunity/access';
import { decrypt } from '@/lib/encryption/decrypt';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasValidBlogSubscription } from '@/lib/payments/blogDonation';
import { normalizeText } from '@/lib/utils';

type RouteContext = { params: Promise<{ siteName: string }> };

const PAGE_SIZE = 50;
const MAX_CONTENT_LENGTH = 10_000;
const MAX_IMAGE_COUNT = 9;
const MAX_IMAGE_SIZE = 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function getStoragePath(siteId: string, postId: string, index: number) {
  return `${siteId}/${postId}/${Date.now()}-${index}-${Math.random().toString(36).slice(2, 10)}.webp`;
}

function getDisplayName(value: string | null | undefined) {
  if (!value) return '알 수 없음';
  try {
    return normalizeText(decrypt(value)) || '알 수 없음';
  } catch {
    return '알 수 없음';
  }
}

async function getPosts(siteId: string, page: number, stigmaId: string | null, isOwner: boolean) {
  const supabaseAdmin = getSupabaseAdmin();
  const from = (page - 1) * PAGE_SIZE;
  const postsResult = await supabaseAdmin
    .from('blog_community_posts')
    .select('id, slug, user_id, content, created_at, edited_at, is_deleted', { count: 'exact' })
    .eq('site_id', siteId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (postsResult.error) throw new Error('커뮤니티 글을 불러오지 못했습니다.');
  const posts = postsResult.data ?? [];
  const postIds = posts.map((post) => post.id);
  const userIds = [...new Set(posts.map((post) => post.user_id))];
  const [imagesResult, stigmasResult, commentsResult, subscriptionsResult, badgesResult] = await Promise.all([
    postIds.length
      ? supabaseAdmin
          .from('blog_community_post_images')
          .select('post_id, image_url, sort_order')
          .in('post_id', postIds)
          .order('sort_order')
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabaseAdmin.from('stigmas').select('id, user_name, avatar').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
    postIds.length
      ? supabaseAdmin.from('blog_community_comments').select('post_id, is_deleted').in('post_id', postIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabaseAdmin
          .from('subscriptions')
          .select('subscriber_user_id, badge_image_url, badge_months')
          .eq('subscription_type', 'subscription_site')
          .eq('target_type', 'site')
          .eq('target_id', siteId)
          .in('subscriber_user_id', userIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from('blog_subscription_badges').select('subscription_months,image_url').eq('site_id', siteId).order('subscription_months'),
  ]);

  if (imagesResult.error || stigmasResult.error || commentsResult.error || subscriptionsResult.error || badgesResult.error)
    throw new Error('커뮤니티 글을 불러오지 못했습니다.');
  const imageMap = new Map<string, string[]>();
  for (const image of imagesResult.data ?? []) {
    const images = imageMap.get(image.post_id) ?? [];
    images.push(image.image_url);
    imageMap.set(image.post_id, images);
  }
  const authorMap = new Map(
    (stigmasResult.data ?? []).map((stigma) => [
      stigma.id,
      { name: getDisplayName(stigma.user_name), avatarUrl: stigma.avatar ?? null },
    ]),
  );
  const commentCountMap = new Map<string, number>();
  for (const comment of commentsResult.data ?? []) {
    if (comment.is_deleted) continue;
    commentCountMap.set(comment.post_id, (commentCountMap.get(comment.post_id) ?? 0) + 1);
  }
  const badgeMap = new Map<string, string>();
  for (const subscription of subscriptionsResult.data ?? []) {
    if (badgeMap.has(subscription.subscriber_user_id)) continue;
    if (
      await hasValidBlogSubscription({
        supabaseAdmin,
        subscriberId: subscription.subscriber_user_id,
        siteId,
      })
    )
      badgeMap.set(
        subscription.subscriber_user_id,
        subscription.badge_image_url ??
          (badgesResult.data ?? []).filter((badge) => badge.subscription_months <= subscription.badge_months).at(-1)?.image_url ??
          (badgesResult.data ?? [])[0]?.image_url ?? '',
      );
  }

  return {
    posts: posts.map((post) => ({
      slug: String(post.slug),
      content: post.content,
      createdAt: post.created_at,
      editedAt: post.edited_at,
      authorName: authorMap.get(post.user_id)?.name ?? '알 수 없음',
      authorAvatarUrl: authorMap.get(post.user_id)?.avatarUrl ?? null,
      authorBadgeUrl: badgeMap.get(post.user_id) ?? null,
      isAuthor: stigmaId === post.user_id,
      canDelete: isOwner || stigmaId === post.user_id,
      commentCount: commentCountMap.get(post.id) ?? 0,
      images: imageMap.get(post.id) ?? [],
    })),
    totalCount: postsResult.count ?? 0,
  };
}

async function getOperatorDeletedPosts(siteId: string, ownerId: string) {
  const result = await getSupabaseAdmin()
    .from('blog_community_posts')
    .select('slug, content, created_at, deleted_at')
    .eq('site_id', siteId)
    .eq('is_deleted', true)
    .eq('deleted_by', ownerId)
    .order('deleted_at', { ascending: false });
  if (result.error) throw new Error('삭제된 글을 불러오지 못했습니다.');
  return (result.data ?? []).map((post) => ({
    slug: String(post.slug),
    content: post.content,
    createdAt: post.created_at,
    deletedAt: post.deleted_at,
  }));
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { siteName } = await context.params;
    const feature = await getBlogCommunityEnablement(siteName);
    if (!feature) return Response.json({ error: '블로그를 찾을 수 없습니다.' }, { status: 404 });

    const url = new URL(request.url);
    const requestedPage = Number(url.searchParams.get('page') ?? '1');
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const isSummary = url.searchParams.get('summary') === '1';
    const isManage = url.searchParams.get('manage') === '1';
    const list =
      !isSummary && feature.canUse
        ? await getPosts(feature.siteId, page, feature.stigmaId, feature.isOwner)
        : { posts: [], totalCount: 0 };
    const deletedPosts =
      isManage && feature.isOwner && feature.hasStarted
        ? await getOperatorDeletedPosts(feature.siteId, feature.ownerId)
        : [];

    return Response.json({
      feature: {
        isPersonalBlog: feature.isPersonalBlog,
        hasBeenOpenFor15Days: feature.hasBeenOpenFor15Days,
        seriesPostCount: feature.seriesPostCount,
        isEligible: feature.isEligible,
        hasStarted: feature.hasStarted,
        isEnabled: feature.isEnabled,
        isOwner: feature.isOwner,
        isSubscriber: feature.isSubscriber,
        canUse: feature.canUse,
        isIdentityVerified: feature.isIdentityVerified,
        isAtLeastAge14: feature.isAtLeastAge14,
        canEnable: feature.canEnable,
      },
      page,
      pageSize: PAGE_SIZE,
      totalCount: list.totalCount,
      posts: list.posts,
      deletedPosts,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '커뮤니티 정보를 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { siteName } = await context.params;
    const feature = await getBlogCommunityEnablement(siteName);
    if (!feature) return Response.json({ error: '블로그를 찾을 수 없습니다.' }, { status: 404 });
    if (!feature.isOwner) return Response.json({ error: '블로그 운영자만 변경할 수 있습니다.' }, { status: 403 });
    if (!feature.isPersonalBlog)
      return Response.json({ error: '개인 블로그에서만 사용할 수 있습니다.' }, { status: 400 });
    if (!feature.isEligible)
      return Response.json(
        { error: '개설 후 15일이 지나고 연재글을 5개 이상 작성한 뒤 사용할 수 있습니다.' },
        { status: 400 },
      );
    if (!feature.isIdentityVerified)
      return Response.json({ error: '본인인증 후 사용할 수 있습니다.' }, { status: 400 });
    if (!feature.isAtLeastAge14)
      return Response.json({ error: '만 14세 미만은 커뮤니티를 생성할 수 없어요' }, { status: 400 });

    const body = (await request.json().catch(() => null)) as { isEnabled?: unknown } | null;
    if (typeof body?.isEnabled !== 'boolean')
      return Response.json({ error: '사용 여부가 올바르지 않습니다.' }, { status: 400 });

    const now = new Date().toISOString();
    const result = await getSupabaseAdmin()
      .from('blog_communities')
      .upsert({
        site_id: feature.siteId,
        is_enabled: body.isEnabled,
        enabled_at: body.isEnabled ? now : null,
        disabled_at: body.isEnabled ? null : now,
        updated_at: now,
      });
    if (result.error) throw new Error('커뮤니티 사용 여부를 저장하지 못했습니다.');
    return Response.json({ ok: true, isEnabled: body.isEnabled });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '커뮤니티 사용 여부를 저장하지 못했습니다.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { siteName } = await context.params;
    const feature = await getBlogCommunityContext(siteName);
    if (!feature) return Response.json({ error: '블로그를 찾을 수 없습니다.' }, { status: 404 });
    assertBlogCommunityUse(feature);
    if (!feature.stigmaId) return Response.json({ error: '로그인 후 글을 작성할 수 있습니다.' }, { status: 401 });

    const formData = await request.formData();
    const rawContent = formData.get('content');
    const content = normalizeText(typeof rawContent === 'string' ? rawContent : '');
    const files = formData.getAll('images').filter((value): value is File => value instanceof File);
    if (!content) return Response.json({ error: '내용을 입력해주세요.' }, { status: 400 });
    if (content.length > MAX_CONTENT_LENGTH)
      return Response.json({ error: '내용은 10,000자 이하로 입력해주세요.' }, { status: 400 });
    if (files.length > MAX_IMAGE_COUNT)
      return Response.json({ error: '이미지는 최대 9장까지 등록할 수 있습니다.' }, { status: 400 });
    for (const file of files) {
      if (!IMAGE_MIME_TYPES.has(file.type))
        return Response.json({ error: 'JPG, PNG, WEBP 이미지만 등록할 수 있습니다.' }, { status: 400 });
      if (file.size > MAX_IMAGE_SIZE)
        return Response.json({ error: '이미지 한 장은 1MB 이하만 등록할 수 있습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    let postResult = await supabaseAdmin
      .from('blog_community_posts')
      .insert({ site_id: feature.siteId, user_id: feature.stigmaId, content })
      .select('id, slug, created_at')
      .single();
    for (let attempt = 0; postResult.error?.code === '23505' && attempt < 2; attempt += 1) {
      postResult = await supabaseAdmin
        .from('blog_community_posts')
        .insert({ site_id: feature.siteId, user_id: feature.stigmaId, content })
        .select('id, slug, created_at')
        .single();
    }
    if (postResult.error || !postResult.data) {
      const detail = postResult.error?.message || '알 수 없는 오류';
      throw new Error(process.env.NODE_ENV === 'development' ? `글을 게시하지 못했습니다. (${detail})` : '글을 게시하지 못했습니다.');
    }

    const uploadedImages: { post_id: string; image_url: string; sort_order: number }[] = [];
    let imageUploadError = false;
    for (const [index, file] of files.entries()) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const webp = await sharp(buffer).webp({ quality: 90 }).toBuffer();
        const path = getStoragePath(feature.siteId, postResult.data.id, index);
        const upload = await supabaseAdmin.storage
          .from('blog-community')
          .upload(path, webp, { contentType: 'image/webp', upsert: false });
        if (upload.error) throw upload.error;
        const url = supabaseAdmin.storage.from('blog-community').getPublicUrl(path).data.publicUrl;
        uploadedImages.push({ post_id: postResult.data.id, image_url: url, sort_order: index });
      } catch {
        imageUploadError = true;
      }
    }
    if (uploadedImages.length) {
      const imageResult = await supabaseAdmin.from('blog_community_post_images').insert(uploadedImages);
      if (imageResult.error) imageUploadError = true;
    }

    return Response.json({ ok: true, slug: String(postResult.data.slug), imageUploadError });
  } catch (error) {
    const message = error instanceof Error ? error.message : '글을 게시하지 못했습니다.';
    const status = /구독자만|사용하지 않고|개인 블로그/.test(message) ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
