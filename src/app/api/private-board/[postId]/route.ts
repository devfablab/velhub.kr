import { decrypt } from '@/lib/encryption/decrypt';
import { getPrivateBoardAccess, getPrivateBoardSiteName } from '@/lib/private-board/access';
import { normalizeText } from '@/lib/utils';

function getFallbackAuthorName(value: string | null | undefined) {
  const encryptedName = normalizeText(value);

  if (!encryptedName) return '';

  try {
    return decrypt(encryptedName);
  } catch {
    return '';
  }
}

async function getPostAccess(request: Request, postId: string) {
  const siteName = getPrivateBoardSiteName(new URL(request.url).searchParams.get('siteName'));
  if (!siteName || !postId) return { ok: false, status: 400, error: '요청 정보가 유효하지 않습니다.' } as const;
  const access = await getPrivateBoardAccess(siteName);
  if (!access.ok) return access;
  const post = await access.supabaseAdmin
    .from('private_posts')
    .select('*')
    .eq('id', postId)
    .eq('site_id', access.site.id)
    .maybeSingle();
  if (post.error || !post.data) return { ok: false, status: 404, error: '글을 찾을 수 없습니다.' } as const;
  if (!access.isStaff && post.data.author_stigma_id !== access.stigmaId)
    return { ok: false, status: 403, error: '접근 권한이 없습니다.' } as const;
  return { ok: true, access, post: post.data } as const;
}

export async function GET(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const result = await getPostAccess(request, postId);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  const replies = await result.access.supabaseAdmin
    .from('private_post_replies')
    .select('*')
    .eq('private_post_id', postId)
    .order('created_at');
  if (replies.error) return Response.json({ error: '답변을 불러오지 못했습니다.' }, { status: 500 });
  const allReplies = replies.data ?? [];
  const hasReply = allReplies.length > 0;
  const now = Date.now();
  const visibleReplies = result.access.isStaff
    ? allReplies
    : allReplies.filter(
        (reply) => reply.author_type !== 'staff' || now - new Date(reply.created_at).getTime() >= 5 * 60 * 1000,
      );
  let navigationQuery = result.access.supabaseAdmin
    .from('private_posts')
    .select('id, subject, created_at')
    .eq('site_id', result.access.site.id);
  if (!result.access.isStaff) navigationQuery = navigationQuery.eq('author_stigma_id', result.access.stigmaId);
  let nextNavigationQuery = result.access.supabaseAdmin
    .from('private_posts')
    .select('id, subject, created_at')
    .eq('site_id', result.access.site.id);
  if (!result.access.isStaff) nextNavigationQuery = nextNavigationQuery.eq('author_stigma_id', result.access.stigmaId);
  const [previous, next] = await Promise.all([
    navigationQuery
      .lt('created_at', result.post.created_at)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    nextNavigationQuery.gt('created_at', result.post.created_at).order('created_at').limit(1).maybeSingle(),
  ]);

  const authorStigma = await result.access.supabaseAdmin
    .from('stigmas')
    .select('id, user_id, avatar, user_name')
    .eq('id', result.post.author_stigma_id)
    .maybeSingle();
  const [authorMembership, authorUser, authorCreator] = await Promise.all([
    result.access.supabaseAdmin
      .from('rhizome_stigmas')
      .select('nickname')
      .eq('site_id', result.access.site.id)
      .eq('user_id', result.post.author_stigma_id)
      .maybeSingle(),
    authorStigma.data?.user_id
      ? result.access.supabaseAdmin
          .from('users')
          .select('handle_name')
          .eq('user_id', authorStigma.data.user_id)
          .maybeSingle()
      : { data: null },
    authorStigma.data?.user_id
      ? result.access.supabaseAdmin
          .from('creators')
          .select('handle_name')
          .eq('user_id', authorStigma.data.user_id)
          .maybeSingle()
      : { data: null },
  ]);
  const avatarValue = normalizeText(authorStigma.data?.avatar);
  const authorAvatarUrl = avatarValue
    ? /^https?:\/\//i.test(avatarValue)
      ? avatarValue
      : (result.access.supabaseAdmin.storage.from('avatar').getPublicUrl(avatarValue).data.publicUrl ?? '')
    : '';
  const repliesWithAuthors = await Promise.all(
    visibleReplies.map(async (reply) => {
      const replyAuthorStigma = await result.access.supabaseAdmin
        .from('stigmas')
        .select('user_id, avatar, user_name')
        .eq('id', reply.author_stigma_id)
        .maybeSingle();
      const [replyAuthorMembership, replyAuthorUser, replyAuthorCreator] = await Promise.all([
        result.access.supabaseAdmin
          .from('rhizome_stigmas')
          .select('nickname')
          .eq('site_id', result.access.site.id)
          .eq('user_id', reply.author_stigma_id)
          .maybeSingle(),
        replyAuthorStigma.data?.user_id
          ? result.access.supabaseAdmin
              .from('users')
              .select('handle_name')
              .eq('user_id', replyAuthorStigma.data.user_id)
              .maybeSingle()
          : { data: null },
        replyAuthorStigma.data?.user_id
          ? result.access.supabaseAdmin
              .from('creators')
              .select('handle_name')
              .eq('user_id', replyAuthorStigma.data.user_id)
              .maybeSingle()
          : { data: null },
      ]);
      const replyAvatarValue = normalizeText(replyAuthorStigma.data?.avatar);

      return {
        ...reply,
        can_edit:
          reply.author_type === 'staff' &&
          reply.author_stigma_id === result.access.stigmaId &&
          now - new Date(reply.created_at).getTime() <= 5 * 60 * 1000,
        author_name:
          normalizeText(replyAuthorMembership.data?.nickname) ||
          normalizeText(replyAuthorUser.data?.handle_name) ||
          normalizeText(replyAuthorCreator.data?.handle_name) ||
          getFallbackAuthorName(replyAuthorStigma.data?.user_name) ||
          '알 수 없음',
        author_avatar_url: replyAvatarValue
          ? /^https?:\/\//i.test(replyAvatarValue)
            ? replyAvatarValue
            : (result.access.supabaseAdmin.storage.from('avatar').getPublicUrl(replyAvatarValue).data.publicUrl ?? '')
          : '',
      };
    }),
  );
  return Response.json({
    canEditPost:
      result.post.author_stigma_id === result.access.stigmaId &&
      Date.now() - new Date(result.post.created_at).getTime() <= 5 * 60 * 1000,
    canDeletePost: result.post.author_stigma_id === result.access.stigmaId && !hasReply,
    post: {
      ...result.post,
      author_name:
        normalizeText(authorMembership.data?.nickname) ||
        normalizeText(authorUser.data?.handle_name) ||
        normalizeText(authorCreator.data?.handle_name) ||
        getFallbackAuthorName(authorStigma.data?.user_name) ||
        '알 수 없음',
      author_avatar_url: authorAvatarUrl,
    },
    replies: repliesWithAuthors,
    isStaff: result.access.isStaff,
    currentStigmaId: result.access.stigmaId,
    previousPost: previous.data,
    nextPost: next.data,
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const result = await getPostAccess(request, postId);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  if (result.post.author_stigma_id !== result.access.stigmaId)
    return Response.json({ error: '본인이 작성한 글만 삭제할 수 있습니다.' }, { status: 403 });
  const reply = await result.access.supabaseAdmin
    .from('private_post_replies')
    .select('id')
    .eq('private_post_id', postId)
    .limit(1)
    .maybeSingle();
  if (reply.data) return Response.json({ error: '답변이 등록된 글은 삭제할 수 없습니다.' }, { status: 400 });
  const deleted = await result.access.supabaseAdmin
    .from('private_posts')
    .delete()
    .eq('id', postId)
    .eq('site_id', result.access.site.id);
  if (deleted.error) return Response.json({ error: '글 삭제에 실패했습니다.' }, { status: 500 });
  return Response.json({ ok: true });
}

export async function POST(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const result = await getPostAccess(request, postId);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  const body = (await request.json()) as { contentHtml?: string | null };
  const contentHtml = normalizeText(body.contentHtml);
  if (!contentHtml) return Response.json({ error: '내용을 입력해 주세요.' }, { status: 400 });
  const replies = await result.access.supabaseAdmin
    .from('private_post_replies')
    .select('id, author_type, created_at')
    .eq('private_post_id', postId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (replies.error) return Response.json({ error: '답변 상태를 확인하지 못했습니다.' }, { status: 500 });
  const lastReply = replies.data?.[0] ?? null;
  const nextType = result.access.isStaff ? 'staff' : 'user';
  if (
    !result.access.isStaff &&
    lastReply?.author_type === 'staff' &&
    Date.now() - new Date(lastReply.created_at).getTime() < 5 * 60 * 1000
  ) {
    return Response.json({ error: '운영자 답변을 확인할 수 있을 때까지 기다려 주세요.' }, { status: 400 });
  }
  if (lastReply && lastReply.author_type === nextType)
    return Response.json({ error: '상대방의 답변을 기다려 주세요.' }, { status: 400 });
  if (result.access.isStaff && !lastReply && Date.now() - new Date(result.post.created_at).getTime() < 5 * 60 * 1000)
    return Response.json({ error: '작성 후 5분부터 답변할 수 있습니다.' }, { status: 400 });
  const reply = await result.access.supabaseAdmin
    .from('private_post_replies')
    .insert({
      private_post_id: postId,
      parent_reply_id: lastReply?.id ?? null,
      site_id: result.access.site.id,
      author_stigma_id: result.access.stigmaId,
      author_type: nextType,
      content_html: contentHtml,
    })
    .select('id')
    .single();
  if (reply.error || !reply.data) return Response.json({ error: '답변 등록에 실패했습니다.' }, { status: 500 });
  const now = new Date().toISOString();
  if (nextType === 'staff') {
    if (lastReply)
      await result.access.supabaseAdmin
        .from('private_post_replies')
        .update({ answered_at: now })
        .eq('id', lastReply.id);
    else await result.access.supabaseAdmin.from('private_posts').update({ answered_at: now }).eq('id', postId);
  }
  await result.access.supabaseAdmin.from('private_posts').update({ last_message_at: now }).eq('id', postId);
  return Response.json({ id: reply.data.id }, { status: 201 });
}

export async function PUT(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const result = await getPostAccess(request, postId);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  if (result.post.author_stigma_id !== result.access.stigmaId) {
    return Response.json({ error: '본인이 작성한 글만 수정할 수 있습니다.' }, { status: 403 });
  }

  if (Date.now() - new Date(result.post.created_at).getTime() > 5 * 60 * 1000) {
    return Response.json({ error: '글은 작성 후 5분 동안만 수정할 수 있습니다.' }, { status: 400 });
  }

  const body = (await request.json()) as {
    categoryId?: string | null;
    contentHtml?: string | null;
    subject?: string | null;
  };
  const categoryId = normalizeText(body.categoryId);
  const subject = normalizeText(body.subject);
  const contentHtml = normalizeText(body.contentHtml);

  if (!categoryId || !subject || !contentHtml) {
    return Response.json({ error: '카테고리, 제목, 내용을 입력해 주세요.' }, { status: 400 });
  }

  const category = await result.access.supabaseAdmin
    .from('private_board_categories')
    .select('id')
    .eq('id', categoryId)
    .eq('private_board_id', result.access.board.id)
    .maybeSingle();

  if (category.error || !category.data) {
    return Response.json({ error: '카테고리를 찾을 수 없습니다.' }, { status: 400 });
  }

  const update = await result.access.supabaseAdmin
    .from('private_posts')
    .update({
      category_id: categoryId,
      content_html: contentHtml,
      subject,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)
    .eq('site_id', result.access.site.id);

  if (update.error) return Response.json({ error: '글 수정에 실패했습니다.' }, { status: 500 });

  return Response.json({ ok: true });
}
