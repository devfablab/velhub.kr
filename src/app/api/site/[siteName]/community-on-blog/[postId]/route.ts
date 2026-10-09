import { assertBlogCommunityUse, getBlogCommunityContext } from '@/lib/blogCommunity/access';
import { completeBlogCommunityRandomDraw, normalizeBlogCommunityDraw } from '@/lib/blogCommunity/draw';
import { isNumericContentSlug } from '@/lib/contentSlug';
import { decrypt } from '@/lib/encryption/decrypt';
import { getBlogSubscriptionBadgeUrls } from '@/lib/payments/blogDonation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = { params: Promise<{ siteName: string; postId: string }> };
const MAX_CONTENT_LENGTH = 10_000;

function getDisplayName(value: string | null | undefined) {
  try {
    return normalizeText(value ? decrypt(value) : '') || '알 수 없음';
  } catch {
    return '알 수 없음';
  }
}

function getErrorStatus(message: string) {
  if (/구독자만|사용하지 않고|개인 블로그|작성자만|삭제 권한|운영자 또는 매니저/.test(message)) return 403;
  if (/로그인 후/.test(message)) return 401;
  return 500;
}

function toTimestamp(value: string | null) {
  return value ? new Date(value).getTime() : null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { siteName, postId: contentId } = await context.params;
    const slug = contentId.trim();
    if (!isNumericContentSlug(slug)) return Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    const feature = await getBlogCommunityContext(siteName);
    if (!feature) return Response.json({ error: '블로그를 찾을 수 없습니다.' }, { status: 404 });
    assertBlogCommunityUse(feature);
    const supabaseAdmin = getSupabaseAdmin();
    const postResult = await supabaseAdmin
      .from('blog_community_posts')
      .select(
        'id, slug, site_id, user_id, content, created_at, edited_at, is_deleted, draw_type, draw_limit, draw_ends_at',
      )
      .eq('slug', slug)
      .eq('site_id', feature.siteId)
      .maybeSingle();
    if (postResult.error) throw new Error('글을 불러오지 못했습니다.');
    if (!postResult.data || postResult.data.is_deleted)
      return Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });

    await completeBlogCommunityRandomDraw({
      siteId: feature.siteId,
      postId: postResult.data.id,
      drawType:
        postResult.data.draw_type === 'first_come' || postResult.data.draw_type === 'random'
          ? postResult.data.draw_type
          : null,
      drawLimit: postResult.data.draw_limit ? Number(postResult.data.draw_limit) : null,
      drawEndsAt: postResult.data.draw_ends_at,
    });
    const canViewDraws = feature.isOperator || feature.stigmaId === postResult.data.user_id;
    const [imagesResult, authorResult, previousResult, nextResult, badgeByUser, drawsResult] = await Promise.all([
      supabaseAdmin
        .from('blog_community_post_images')
        .select('image_url, sort_order')
        .eq('post_id', postResult.data.id)
        .order('sort_order'),
      supabaseAdmin.from('stigmas').select('user_name, avatar').eq('id', postResult.data.user_id).maybeSingle(),
      supabaseAdmin
        .from('blog_community_posts')
        .select('slug')
        .eq('site_id', feature.siteId)
        .eq('is_deleted', false)
        .gt('created_at', postResult.data.created_at)
        .order('created_at')
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('blog_community_posts')
        .select('slug')
        .eq('site_id', feature.siteId)
        .eq('is_deleted', false)
        .lt('created_at', postResult.data.created_at)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      getBlogSubscriptionBadgeUrls({
        supabaseAdmin,
        siteId: feature.siteId,
        subscriberIds: [postResult.data.user_id],
      }),
      canViewDraws && postResult.data.draw_type
        ? supabaseAdmin
            .from('blog_community_post_draws')
            .select('id, user_id, draw_order')
            .eq('post_id', postResult.data.id)
            .order('draw_order')
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (imagesResult.error || authorResult.error || previousResult.error || nextResult.error || drawsResult.error)
      throw new Error('글을 불러오지 못했습니다.');
    const drawUserIds = [...new Set((drawsResult.data ?? []).map((draw) => draw.user_id))];
    const drawAuthorsResult = drawUserIds.length
      ? await supabaseAdmin.from('stigmas').select('id, user_name, avatar').in('id', drawUserIds)
      : { data: [], error: null };
    if (drawAuthorsResult.error) throw new Error('당첨자 목록을 불러오지 못했습니다.');
    const drawAuthorByUser = new Map(
      (drawAuthorsResult.data ?? []).map((author) => [
        author.id,
        { name: getDisplayName(author.user_name), avatarUrl: author.avatar ?? null },
      ]),
    );
    const drawType =
      postResult.data.draw_type === 'first_come' || postResult.data.draw_type === 'random'
        ? postResult.data.draw_type
        : null;
    const drawLimit = postResult.data.draw_limit ? Number(postResult.data.draw_limit) : null;
    const isDrawCompleted =
      drawType === 'first_come'
        ? (drawsResult.data ?? []).length >= (drawLimit ?? 0)
        : Boolean(postResult.data.draw_ends_at && new Date(postResult.data.draw_ends_at).getTime() <= Date.now());
    return Response.json({
      post: {
        slug: String(postResult.data.slug),
        content: postResult.data.content,
        createdAt: postResult.data.created_at,
        editedAt: postResult.data.edited_at,
        authorName: getDisplayName(authorResult.data?.user_name),
        authorAvatarUrl: authorResult.data?.avatar ?? null,
        authorBadgeUrl: badgeByUser.get(postResult.data.user_id) ?? null,
        isAuthor: feature.stigmaId === postResult.data.user_id,
        isOwner: feature.isOwner,
        isOperator: feature.isOperator,
        images: (imagesResult.data ?? []).map((image) => image.image_url),
        draw: drawType
          ? {
              drawType,
              drawLimit,
              drawEndsAt: postResult.data.draw_ends_at,
              isCompleted: isDrawCompleted,
              canViewDraws,
              winners: (drawsResult.data ?? []).map((draw) => ({
                id: draw.id,
                drawOrder: Number(draw.draw_order),
                authorName: drawAuthorByUser.get(draw.user_id)?.name ?? '알 수 없음',
                authorAvatarUrl: drawAuthorByUser.get(draw.user_id)?.avatarUrl ?? null,
              })),
            }
          : null,
      },
      previousPost: previousResult.data ? { slug: String(previousResult.data.slug) } : null,
      nextPost: nextResult.data ? { slug: String(nextResult.data.slug) } : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '글을 불러오지 못했습니다.';
    return Response.json({ error: message }, { status: getErrorStatus(message) });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { siteName, postId: contentId } = await context.params;
    const slug = contentId.trim();
    if (!isNumericContentSlug(slug)) return Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    const feature = await getBlogCommunityContext(siteName);
    if (!feature) return Response.json({ error: '블로그를 찾을 수 없습니다.' }, { status: 404 });
    assertBlogCommunityUse(feature);
    if (!feature.stigmaId) return Response.json({ error: '로그인 후 수정할 수 있습니다.' }, { status: 401 });
    const body = (await request.json().catch(() => null)) as {
      content?: unknown;
      drawType?: unknown;
      drawLimit?: unknown;
      drawEndsAt?: unknown;
    } | null;
    const content = normalizeText(typeof body?.content === 'string' ? body.content : '');
    if (!content) return Response.json({ error: '내용을 입력해주세요.' }, { status: 400 });
    if (content.length > MAX_CONTENT_LENGTH)
      return Response.json({ error: '내용은 10,000자 이하로 입력해주세요.' }, { status: 400 });
    const supabaseAdmin = getSupabaseAdmin();
    const postResult = await supabaseAdmin
      .from('blog_community_posts')
      .select('id, user_id, content, is_deleted, draw_type, draw_limit, draw_ends_at')
      .eq('slug', slug)
      .eq('site_id', feature.siteId)
      .maybeSingle();
    if (postResult.error || !postResult.data || postResult.data.is_deleted)
      return Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    if (postResult.data.user_id !== feature.stigmaId)
      return Response.json({ error: '작성자만 수정할 수 있습니다.' }, { status: 403 });
    const draw = normalizeBlogCommunityDraw(body ?? {});
    if ('error' in draw) return Response.json({ error: draw.error }, { status: 400 });
    const currentDrawType =
      postResult.data.draw_type === 'first_come' || postResult.data.draw_type === 'random'
        ? postResult.data.draw_type
        : null;
    const currentDrawLimit = postResult.data.draw_limit ? Number(postResult.data.draw_limit) : null;
    const drawChanged =
      currentDrawType !== draw.drawType ||
      currentDrawLimit !== draw.drawLimit ||
      toTimestamp(postResult.data.draw_ends_at) !== toTimestamp(draw.drawEndsAt);
    if (drawChanged && !feature.isOperator)
      return Response.json({ error: '운영자 또는 매니저만 추첨 이벤트를 설정할 수 있습니다.' }, { status: 403 });
    if (drawChanged && currentDrawType) {
      const draws = await supabaseAdmin
        .from('blog_community_post_draws')
        .select('id')
        .eq('post_id', postResult.data.id)
        .limit(1);
      if (draws.error) throw new Error('추첨 정보를 확인하지 못했습니다.');
      if ((draws.data ?? []).length)
        return Response.json({ error: '당첨자가 확정된 추첨 이벤트는 수정할 수 없습니다.' }, { status: 400 });
    }
    if (postResult.data.content === content && !drawChanged)
      return Response.json({ error: '변경된 내용이 없습니다.' }, { status: 400 });
    const updateResult = await supabaseAdmin
      .from('blog_community_posts')
      .update({
        content,
        draw_type: draw.drawType,
        draw_limit: draw.drawLimit,
        draw_ends_at: draw.drawEndsAt,
        edited_at: new Date().toISOString(),
      })
      .eq('id', postResult.data.id);
    if (updateResult.error) throw new Error('글을 수정하지 못했습니다.');
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '글을 수정하지 못했습니다.';
    return Response.json({ error: message }, { status: getErrorStatus(message) });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { siteName, postId: contentId } = await context.params;
    const slug = contentId.trim();
    if (!isNumericContentSlug(slug)) return Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    const feature = await getBlogCommunityContext(siteName);
    if (!feature) return Response.json({ error: '블로그를 찾을 수 없습니다.' }, { status: 404 });
    assertBlogCommunityUse(feature);
    if (!feature.stigmaId) return Response.json({ error: '로그인 후 삭제할 수 있습니다.' }, { status: 401 });
    const supabaseAdmin = getSupabaseAdmin();
    const postResult = await supabaseAdmin
      .from('blog_community_posts')
      .select('id, user_id, is_deleted')
      .eq('slug', slug)
      .eq('site_id', feature.siteId)
      .maybeSingle();
    if (postResult.error || !postResult.data || postResult.data.is_deleted)
      return Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    if (!feature.isOwner && postResult.data.user_id !== feature.stigmaId)
      return Response.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
    const result = await supabaseAdmin
      .from('blog_community_posts')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: feature.stigmaId,
        deleted_message: feature.isOwner ? '운영자 삭제' : '작성자 삭제',
      })
      .eq('id', postResult.data.id);
    if (result.error) throw new Error('글을 삭제하지 못했습니다.');
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '글을 삭제하지 못했습니다.';
    return Response.json({ error: message }, { status: getErrorStatus(message) });
  }
}
