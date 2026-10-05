import { assertBlogCommunityUse, getBlogCommunityContext } from '@/lib/blogCommunity/access';
import { isNumericContentSlug } from '@/lib/contentSlug';
import { decrypt } from '@/lib/encryption/decrypt';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = { params: Promise<{ siteName: string; postId: string }> };

function displayName(value: string | null | undefined) {
  try {
    return normalizeText(value ? decrypt(value) : '') || '알 수 없음';
  } catch {
    return '알 수 없음';
  }
}

function getErrorStatus(message: string) {
  if (/구독자만|사용하지 않고|개인 블로그/.test(message)) return 403;
  if (/로그인 후/.test(message)) return 401;
  return 500;
}

function getAvatarUrl(value: string | null | undefined) {
  const avatar = normalizeText(value);

  if (!avatar) return '';
  if (avatar.startsWith('https://') || avatar.startsWith('http://')) return avatar;

  return getSupabaseAdmin().storage.from('avatar').getPublicUrl(avatar).data.publicUrl ?? '';
}

async function assertPost(siteId: string, contentId: string) {
  const slug = contentId.trim();
  if (!isNumericContentSlug(slug)) throw new Error('글을 찾을 수 없습니다.');
  const result = await getSupabaseAdmin()
    .from('blog_community_posts')
    .select('id')
    .eq('slug', slug)
    .eq('site_id', siteId)
    .eq('is_deleted', false)
    .maybeSingle();
  if (result.error || !result.data) throw new Error('글을 찾을 수 없습니다.');
  return result.data;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { siteName, postId } = await context.params;
    const feature = await getBlogCommunityContext(siteName);
    if (!feature) return Response.json({ error: '블로그를 찾을 수 없습니다.' }, { status: 404 });
    assertBlogCommunityUse(feature);
    const post = await getSupabaseAdmin()
      .from('blog_community_posts')
      .select('id, user_id')
      .eq('site_id', feature.siteId)
      .eq('slug', postId.trim())
      .eq('is_deleted', false)
      .maybeSingle();
    if (post.error || !post.data) throw new Error('글을 찾을 수 없습니다.');
    const postData = post.data;
    const supabaseAdmin = getSupabaseAdmin();
    const commentsResult = await supabaseAdmin
      .from('blog_community_comments')
      .select('id, user_id, parent_id, reply_to_id, content, created_at, is_deleted, deleted_at, is_blinded')
      .eq('site_id', feature.siteId)
      .eq('post_id', postData.id)
      .order('created_at');
    if (commentsResult.error) throw new Error('댓글을 불러오지 못했습니다.');
    const userIds = [...new Set((commentsResult.data ?? []).map((comment) => comment.user_id))];
    const authorsResult = userIds.length
      ? await supabaseAdmin.from('stigmas').select('id, user_name, avatar').in('id', userIds)
      : { data: [], error: null };
    if (authorsResult.error) throw new Error('댓글을 불러오지 못했습니다.');
    const authors = new Map(
      (authorsResult.data ?? []).map((author) => [
        author.id,
        { name: displayName(author.user_name), avatarUrl: getAvatarUrl(author.avatar) },
      ]),
    );
    const rows = commentsResult.data ?? [];
    const rowById = new Map(rows.map((comment) => [comment.id, comment]));
    const commentItems = rows.map((comment) => {
      const replyTo = comment.reply_to_id ? rowById.get(comment.reply_to_id) : null;
      const replyToAuthor = replyTo ? authors.get(replyTo.user_id) : null;
      const isDeleted = comment.is_deleted === true;
      const isBlinded = comment.is_blinded === true;
      const isMe = feature.stigmaId === comment.user_id;

      return {
        id: comment.id,
        created_at: comment.created_at,
        parent_id: comment.parent_id,
        reply_to_id: comment.reply_to_id,
        reply_to_author_name: replyToAuthor?.name ?? '',
        content: isDeleted ? '삭제된 댓글입니다.' : isBlinded ? '숨김 처리된 댓글입니다.' : comment.content,
        is_deleted: isDeleted,
        deleted_at: comment.deleted_at,
        is_locked: false,
        is_blinded: isBlinded,
        blinded_at: null,
        blinded_message: null,
        is_pinned: false,
        author_name: authors.get(comment.user_id)?.name ?? '알 수 없음',
        author_avatar_url: authors.get(comment.user_id)?.avatarUrl ?? '',
        author_level: null,
        author_role: 'member' as const,
        author_manage_roles: [],
        author_manage_icon: null,
        is_author: comment.user_id === postData.user_id,
        is_me: isMe,
        can_edit: isMe && !isDeleted && !isBlinded,
        can_delete: (feature.isOwner || isMe) && !isDeleted,
        can_blind: false,
        can_unblind: false,
        can_pin: false,
        poll_choice: null,
        like_count: 0,
        is_liked: false,
        replies: [],
      };
    });
    const repliesByParentId = new Map<string, (typeof commentItems)[number][]>();
    commentItems
      .filter((comment) => comment.parent_id)
      .forEach((comment) => {
        const parentId = comment.parent_id as string;
        repliesByParentId.set(parentId, [...(repliesByParentId.get(parentId) ?? []), comment]);
      });
    const comments = commentItems
      .filter((comment) => !comment.parent_id)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .map((comment) => ({
        ...comment,
        replies: (repliesByParentId.get(comment.id) ?? []).sort(
          (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
        ),
      }));
    const viewerResult = feature.stigmaId
      ? await supabaseAdmin.from('stigmas').select('avatar').eq('id', feature.stigmaId).maybeSingle()
      : { data: null, error: null };
    if (viewerResult.error) throw new Error('댓글을 불러오지 못했습니다.');
    return Response.json({
      comments,
      mySelfAvatarUrl: getAvatarUrl(viewerResult.data?.avatar),
      myPollChoice: null,
      isStaff: false,
      isCommunity: false,
      boardLabel: '',
      actions: {
        canWrite: Boolean(feature.stigmaId),
        canWriteReason: feature.stigmaId ? null : 'guest',
        canManageComment: feature.isOwner,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '댓글을 불러오지 못했습니다.';
    return Response.json(
      { error: message },
      { status: /구독자만|사용하지 않고|개인 블로그/.test(message) ? 403 : 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { siteName, postId } = await context.params;
    const feature = await getBlogCommunityContext(siteName);
    if (!feature) return Response.json({ error: '블로그를 찾을 수 없습니다.' }, { status: 404 });
    assertBlogCommunityUse(feature);
    if (!feature.stigmaId) return Response.json({ error: '로그인 후 댓글을 작성할 수 있습니다.' }, { status: 401 });
    const post = await assertPost(feature.siteId, postId);
    const body = (await request.json().catch(() => null)) as {
      content?: unknown;
      parentId?: unknown;
      replyToId?: unknown;
    } | null;
    const content = normalizeText(typeof body?.content === 'string' ? body.content : '');
    const parentId = normalizeText(typeof body?.parentId === 'string' ? body.parentId : '') || null;
    const replyToId = normalizeText(typeof body?.replyToId === 'string' ? body.replyToId : '') || null;
    if (!content) return Response.json({ error: '댓글을 입력해주세요.' }, { status: 400 });
    if (parentId) {
      const parent = await getSupabaseAdmin()
        .from('blog_community_comments')
        .select('id, parent_id')
        .eq('id', parentId)
        .eq('post_id', post.id)
        .eq('site_id', feature.siteId)
        .maybeSingle();
      if (parent.error || !parent.data || parent.data.parent_id)
        return Response.json({ error: '답글을 작성할 수 없는 댓글입니다.' }, { status: 400 });
    }
    const result = await getSupabaseAdmin()
      .from('blog_community_comments')
      .insert({
        site_id: feature.siteId,
        post_id: post.id,
        user_id: feature.stigmaId,
        content,
        parent_id: parentId,
        reply_to_id: replyToId,
      })
      .select('id')
      .single();
    if (result.error) throw new Error('댓글을 등록하지 못했습니다.');
    return Response.json({ ok: true, commentId: result.data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : '댓글을 등록하지 못했습니다.';
    return Response.json({ error: message }, { status: getErrorStatus(message) });
  }
}
