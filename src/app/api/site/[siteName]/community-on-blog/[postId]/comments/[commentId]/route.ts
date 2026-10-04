import { assertBlogCommunityUse, getBlogCommunityContext } from '@/lib/blogCommunity/access';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = { params: Promise<{ siteName: string; postId: string; commentId: string }> };

async function getCommentTarget(siteName: string, contentId: string, commentId: string) {
  const feature = await getBlogCommunityContext(siteName);
  if (!feature) throw new Error('블로그를 찾을 수 없습니다.');
  assertBlogCommunityUse(feature);
  if (!feature.stigmaId) throw new Error('로그인 후 이용할 수 있습니다.');

  const supabaseAdmin = getSupabaseAdmin();
  const slug = contentId.trim();
  if (!slug) throw new Error('글을 찾을 수 없습니다.');
  const postResult = await supabaseAdmin
    .from('blog_community_posts')
    .select('id')
    .eq('site_id', feature.siteId)
    .eq('slug', slug)
    .eq('is_deleted', false)
    .maybeSingle();
  if (postResult.error || !postResult.data) throw new Error('글을 찾을 수 없습니다.');

  const commentResult = await supabaseAdmin
    .from('blog_community_comments')
    .select('id, user_id, is_deleted')
    .eq('id', commentId)
    .eq('post_id', postResult.data.id)
    .eq('site_id', feature.siteId)
    .maybeSingle();
  if (commentResult.error || !commentResult.data || commentResult.data.is_deleted)
    throw new Error('댓글을 찾을 수 없습니다.');

  return { feature, supabaseAdmin, comment: commentResult.data };
}

function getErrorStatus(message: string) {
  if (/로그인 후/.test(message)) return 401;
  if (/구독자만|사용하지 않고|개인 블로그|권한/.test(message)) return 403;
  if (/찾을 수 없습니다/.test(message)) return 404;
  return 500;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { siteName, postId: contentId, commentId } = await context.params;
    const { feature, supabaseAdmin, comment } = await getCommentTarget(siteName, contentId, commentId);
    if (comment.user_id !== feature.stigmaId)
      return Response.json({ error: '댓글 수정 권한이 없습니다.' }, { status: 403 });
    const body = (await request.json().catch(() => null)) as { content?: unknown } | null;
    const content = normalizeText(typeof body?.content === 'string' ? body.content : '');
    if (!content) return Response.json({ error: '댓글을 입력해주세요.' }, { status: 400 });
    const result = await supabaseAdmin.from('blog_community_comments').update({ content }).eq('id', comment.id);
    if (result.error) throw new Error('댓글을 수정하지 못했습니다.');
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '댓글을 수정하지 못했습니다.';
    return Response.json({ error: message }, { status: getErrorStatus(message) });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { siteName, postId: contentId, commentId } = await context.params;
    const { feature, supabaseAdmin, comment } = await getCommentTarget(siteName, contentId, commentId);
    if (!feature.isOwner && comment.user_id !== feature.stigmaId)
      return Response.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
    const result = await supabaseAdmin
      .from('blog_community_comments')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: feature.stigmaId,
        deleted_message: feature.isOwner ? '운영자 삭제' : '작성자 삭제',
      })
      .eq('id', comment.id);
    if (result.error) throw new Error('댓글을 삭제하지 못했습니다.');
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '댓글을 삭제하지 못했습니다.';
    return Response.json({ error: message }, { status: getErrorStatus(message) });
  }
}
