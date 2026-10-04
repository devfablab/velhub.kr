import { assertBlogCommunityUse, getBlogCommunityContext } from '@/lib/blogCommunity/access';
import { decrypt } from '@/lib/encryption/decrypt';
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
  if (/구독자만|사용하지 않고|개인 블로그|작성자만|삭제 권한/.test(message)) return 403;
  if (/로그인 후/.test(message)) return 401;
  return 500;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { siteName, postId: contentId } = await context.params;
    const slug = contentId.trim();
    if (!slug) return Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    const feature = await getBlogCommunityContext(siteName);
    if (!feature) return Response.json({ error: '블로그를 찾을 수 없습니다.' }, { status: 404 });
    assertBlogCommunityUse(feature);
    const supabaseAdmin = getSupabaseAdmin();
    const postResult = await supabaseAdmin
      .from('blog_community_posts')
      .select('id, slug, site_id, user_id, content, created_at, edited_at, is_deleted')
      .eq('slug', slug)
      .eq('site_id', feature.siteId)
      .maybeSingle();
    if (postResult.error) throw new Error('글을 불러오지 못했습니다.');
    if (!postResult.data || postResult.data.is_deleted)
      return Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });

    const [imagesResult, authorResult, previousResult, nextResult] = await Promise.all([
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
    ]);
    if (imagesResult.error || authorResult.error || previousResult.error || nextResult.error)
      throw new Error('글을 불러오지 못했습니다.');
    return Response.json({
      post: {
        slug: String(postResult.data.slug),
        content: postResult.data.content,
        createdAt: postResult.data.created_at,
        editedAt: postResult.data.edited_at,
        authorName: getDisplayName(authorResult.data?.user_name),
        authorAvatarUrl: authorResult.data?.avatar ?? null,
        isAuthor: feature.stigmaId === postResult.data.user_id,
        isOwner: feature.isOwner,
        images: (imagesResult.data ?? []).map((image) => image.image_url),
      },
      previousPost: previousResult.data ? { slug: String(previousResult.data.slug) } : null,
      nextPost: nextResult.data ? { slug: String(nextResult.data.slug) } : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '글을 불러오지 못했습니다.';
    return Response.json(
      { error: message },
      { status: /구독자만|사용하지 않고|개인 블로그/.test(message) ? 403 : 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { siteName, postId: contentId } = await context.params;
    const slug = contentId.trim();
    if (!slug) return Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    const feature = await getBlogCommunityContext(siteName);
    if (!feature) return Response.json({ error: '블로그를 찾을 수 없습니다.' }, { status: 404 });
    assertBlogCommunityUse(feature);
    if (!feature.stigmaId) return Response.json({ error: '로그인 후 수정할 수 있습니다.' }, { status: 401 });
    const body = (await request.json().catch(() => null)) as { content?: unknown } | null;
    const content = normalizeText(typeof body?.content === 'string' ? body.content : '');
    if (!content) return Response.json({ error: '내용을 입력해주세요.' }, { status: 400 });
    if (content.length > MAX_CONTENT_LENGTH)
      return Response.json({ error: '내용은 10,000자 이하로 입력해주세요.' }, { status: 400 });
    const supabaseAdmin = getSupabaseAdmin();
    const postResult = await supabaseAdmin
      .from('blog_community_posts')
      .select('id, user_id, content, is_deleted')
      .eq('slug', slug)
      .eq('site_id', feature.siteId)
      .maybeSingle();
    if (postResult.error || !postResult.data || postResult.data.is_deleted)
      return Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    if (postResult.data.user_id !== feature.stigmaId)
      return Response.json({ error: '작성자만 수정할 수 있습니다.' }, { status: 403 });
    if (postResult.data.content === content)
      return Response.json({ error: '변경된 내용이 없습니다.' }, { status: 400 });
    const updateResult = await supabaseAdmin
      .from('blog_community_posts')
      .update({ content, edited_at: new Date().toISOString() })
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
    if (!slug) return Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
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
