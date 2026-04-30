import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
    contentId: string;
    commentId: string;
  }>;
};

type RequestBody = {
  siteName?: string | null;
  action?: 'edit' | 'blind' | 'unblind' | null;
  content?: string | null;
  blindedMessage?: string | null;
};

function isNumericSlug(value: string) {
  return /^\d+$/.test(value);
}

function isManageRole(value: string) {
  return (
    value === 'community-manager' ||
    value === 'board-manager' ||
    value === 'board-general-manager' ||
    value === 'board-assistant-manager'
  );
}

async function getCommentAccess(siteId: string, boardId: string, userId: string | null, sessionCase: string) {
  if (sessionCase === 'staff' || sessionCase === 'admin') {
    return true;
  }

  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    return false;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const stigmaByAuthIdResult = await supabaseAdmin
    .from('stigmas')
    .select('id')
    .eq('user_id', normalizedUserId)
    .maybeSingle();

  const stigmaId = normalizeText(stigmaByAuthIdResult.data?.id) || normalizedUserId;

  const membershipResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('id, role')
    .eq('site_id', siteId)
    .eq('user_id', stigmaId)
    .maybeSingle();

  if (membershipResult.error || !membershipResult.data) {
    return false;
  }

  if (membershipResult.data.role === 'owner') {
    return true;
  }

  const communityResult = await supabaseAdmin.from('communities').select('id').eq('site_id', siteId).maybeSingle();

  if (communityResult.error || !communityResult.data?.id) {
    return false;
  }

  const manageRoleResult = await supabaseAdmin
    .from('community_manage_role')
    .select('role, board_id')
    .eq('community_id', communityResult.data.id)
    .eq('manager_id', membershipResult.data.id);

  if (manageRoleResult.error) {
    return false;
  }

  return (manageRoleResult.data ?? []).some((row) => {
    const role = normalizeText(row.role);

    if (!isManageRole(role)) {
      return false;
    }

    if (role === 'community-manager' || role === 'board-manager') {
      return true;
    }

    return row.board_id === boardId;
  });
}

async function getBoardPostAndComment(siteName: string, boardName: string, contentId: string, commentId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizome = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

  if (rhizome.error || !rhizome.data) {
    return {
      error: Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 }),
      data: null,
    };
  }

  const board = await supabaseAdmin
    .from('boards')
    .select('id, board_key, board_type')
    .eq('site_id', rhizome.data.id)
    .eq('board_key', boardName)
    .maybeSingle();

  if (board.error || !board.data) {
    return {
      error: Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 }),
      data: null,
    };
  }

  const postQuery = supabaseAdmin
    .from('posts')
    .select('id, user_id, is_closed, published_status, is_comment')
    .eq('site_id', rhizome.data.id)
    .eq('board_id', board.data.id);

  const post = isNumericSlug(contentId)
    ? await postQuery.eq('slug', Number(contentId)).maybeSingle()
    : await postQuery.eq('id', contentId).maybeSingle();

  if (post.error || !post.data) {
    return {
      error: Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 }),
      data: null,
    };
  }

  const comment = await supabaseAdmin
    .from('post_comments')
    .select(
      'id, site_id, board_id, post_id, user_id, parent_id, content, is_deleted, deleted_at, deleted_by, is_blinded, blinded_at, blinded_by, blinded_message',
    )
    .eq('id', commentId)
    .eq('site_id', rhizome.data.id)
    .eq('board_id', board.data.id)
    .eq('post_id', post.data.id)
    .maybeSingle();

  if (comment.error || !comment.data) {
    return {
      error: Response.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 }),
      data: null,
    };
  }

  return {
    error: null,
    data: {
      siteId: rhizome.data.id as string,
      boardId: board.data.id as string,
      postId: post.data.id as string,
      postAuthorId: post.data.user_id as string,
      isClosed: post.data.is_closed === true,
      isPublished: post.data.published_status === 'published',
      isCommentEnabled: post.data.is_comment !== false,
      comment: comment.data,
    },
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { boardName, contentId, commentId } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const normalizedContentId = normalizeText(contentId);
    const normalizedCommentId = normalizeText(commentId);

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!normalizedContentId) {
      return Response.json({ error: 'contentId가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!normalizedCommentId) {
      return Response.json({ error: 'commentId가 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as RequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const action = requestBody.action === 'blind' || requestBody.action === 'unblind' ? requestBody.action : 'edit';
    const content = normalizeText(requestBody.content);
    const blindedMessage = normalizeText(requestBody.blindedMessage);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const target = await getBoardPostAndComment(
      siteName,
      normalizedBoardName,
      normalizedContentId,
      normalizedCommentId,
    );

    if (target.error || !target.data) {
      return target.error;
    }

    const session = await verifySession({
      siteId: target.data.siteId,
    });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요한 서비스입니다.' }, { status: 401 });
    }

    const canManageComment = await getCommentAccess(
      target.data.siteId,
      target.data.boardId,
      session.authUserId,
      session.case,
    );

    const isMe = target.data.comment.user_id === session.authUserId;

    if (target.data.comment.is_deleted) {
      return Response.json({ error: '삭제된 댓글은 수정할 수 없습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    if (action === 'edit') {
      if (!isMe) {
        return Response.json({ error: '댓글을 수정할 권한이 없습니다.' }, { status: 403 });
      }

      if (target.data.comment.is_blinded) {
        return Response.json({ error: '숨겨진 댓글은 수정할 수 없습니다.' }, { status: 400 });
      }

      if (!content) {
        return Response.json({ error: '댓글 내용을 입력해주세요.' }, { status: 400 });
      }

      const updateResult = await supabaseAdmin
        .from('post_comments')
        .update({
          content,
        })
        .eq('id', target.data.comment.id)
        .select('id')
        .maybeSingle();

      if (updateResult.error || !updateResult.data) {
        return Response.json({ error: '댓글 수정에 실패했습니다.' }, { status: 500 });
      }

      return Response.json({
        ok: true,
      });
    }

    if (!canManageComment) {
      return Response.json({ error: '댓글 숨김 권한이 없습니다.' }, { status: 403 });
    }

    if (action === 'blind') {
      const updateResult = await supabaseAdmin
        .from('post_comments')
        .update({
          is_blinded: true,
          blinded_at: new Date().toISOString(),
          blinded_by: session.authUserId,
          blinded_message: blindedMessage || null,
        })
        .eq('id', target.data.comment.id)
        .select('id')
        .maybeSingle();

      if (updateResult.error || !updateResult.data) {
        return Response.json({ error: '댓글 숨김에 실패했습니다.' }, { status: 500 });
      }

      return Response.json({
        ok: true,
      });
    }

    const updateResult = await supabaseAdmin
      .from('post_comments')
      .update({
        is_blinded: false,
        blinded_at: null,
        blinded_by: null,
        blinded_message: null,
      })
      .eq('id', target.data.comment.id)
      .select('id')
      .maybeSingle();

    if (updateResult.error || !updateResult.data) {
      return Response.json({ error: '댓글 숨김 취소에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '댓글 처리에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '댓글 처리에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { boardName, contentId, commentId } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const normalizedContentId = normalizeText(contentId);
    const normalizedCommentId = normalizeText(commentId);

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!normalizedContentId) {
      return Response.json({ error: 'contentId가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!normalizedCommentId) {
      return Response.json({ error: 'commentId가 유효하지 않습니다.' }, { status: 400 });
    }

    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const target = await getBoardPostAndComment(
      siteName,
      normalizedBoardName,
      normalizedContentId,
      normalizedCommentId,
    );

    if (target.error || !target.data) {
      return target.error;
    }

    const session = await verifySession({
      siteId: target.data.siteId,
    });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요한 서비스입니다.' }, { status: 401 });
    }

    const canManageComment = await getCommentAccess(
      target.data.siteId,
      target.data.boardId,
      session.authUserId,
      session.case,
    );

    const isMe = target.data.comment.user_id === session.authUserId;

    if (!isMe && !canManageComment) {
      return Response.json({ error: '댓글을 삭제할 권한이 없습니다.' }, { status: 403 });
    }

    if (target.data.comment.is_deleted) {
      return Response.json({ ok: true });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const updateResult = await supabaseAdmin
      .from('post_comments')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: session.authUserId,
      })
      .eq('id', target.data.comment.id)
      .select('id')
      .maybeSingle();

    if (updateResult.error || !updateResult.data) {
      return Response.json({ error: '댓글 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '댓글 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '댓글 삭제에 실패했습니다.' }, { status: 500 });
  }
}
