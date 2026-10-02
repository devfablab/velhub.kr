import { getCommunityManagerAccess } from '@/lib/community/community-manager/utils';
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

function isNumericSlug(value: string) {
  return /^\d+$/.test(value);
}

async function getPinTarget({
  siteName,
  boardName,
  contentId,
  commentId,
}: {
  siteName: string;
  boardName: string;
  contentId: string;
  commentId: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_type')
    .eq('site_key', siteName)
    .maybeSingle();

  if (siteResult.error || !siteResult.data) {
    return { error: Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 }), data: null };
  }

  if (siteResult.data.site_type !== 'community') {
    return { error: Response.json({ error: '커뮤니티 댓글만 고정할 수 있습니다.' }, { status: 403 }), data: null };
  }

  const boardResult = await supabaseAdmin
    .from('boards')
    .select('id, board_type')
    .eq('site_id', siteResult.data.id)
    .eq('board_key', boardName)
    .maybeSingle();

  if (boardResult.error || !boardResult.data) {
    return { error: Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 }), data: null };
  }

  if (boardResult.data.board_type === 'page') {
    return { error: Response.json({ error: '댓글을 고정할 수 없는 게시판입니다.' }, { status: 400 }), data: null };
  }

  const postQuery = supabaseAdmin
    .from('posts')
    .select('id, user_id')
    .eq('site_id', siteResult.data.id)
    .eq('board_id', boardResult.data.id);
  const postResult = isNumericSlug(contentId)
    ? await postQuery.eq('slug', Number(contentId)).maybeSingle()
    : await postQuery.eq('id', contentId).maybeSingle();

  if (postResult.error || !postResult.data) {
    return { error: Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 }), data: null };
  }

  const commentResult = await supabaseAdmin
    .from('post_comments')
    .select('id, user_id, parent_id, is_deleted, is_blinded, is_pinned')
    .eq('id', commentId)
    .eq('site_id', siteResult.data.id)
    .eq('board_id', boardResult.data.id)
    .eq('post_id', postResult.data.id)
    .maybeSingle();

  if (commentResult.error || !commentResult.data) {
    return { error: Response.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 }), data: null };
  }

  return {
    error: null,
    data: {
      siteId: siteResult.data.id as string,
      boardId: boardResult.data.id as string,
      postId: postResult.data.id as string,
      postAuthorId: postResult.data.user_id as string,
      comment: commentResult.data,
    },
  };
}

async function canPinComment({ siteName, boardId, postAuthorId, siteId }: { siteName: string; boardId: string; postAuthorId: string; siteId: string }) {
  const session = await verifySession({ siteId });

  if (!session.authUserId || !session.stigmaId) {
    return { allowed: false, session };
  }

  if (session.stigmaId === postAuthorId || session.case === 'staff' || session.case === 'admin') {
    return { allowed: true, session };
  }

  try {
    const access = await getCommunityManagerAccess(siteName, { requireManagerControlPermission: false });
    const isCommunityManager = access.actor.communityRoles.some((role) =>
      ['owner', 'community-manager', 'board-manager'].includes(role),
    );
    const isBoardManager = access.actor.managedBoardIds.includes(boardId);

    return { allowed: isCommunityManager || isBoardManager, session };
  } catch {
    return { allowed: false, session };
  }
}

async function updatePin(request: Request, context: RouteContext, isPinned: boolean) {
  try {
    const { boardName, contentId, commentId } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const normalizedContentId = normalizeText(contentId);
    const normalizedCommentId = normalizeText(commentId);
    const requestBody = (await request.json()) as { siteName?: string | null };
    const siteName = normalizeText(requestBody.siteName).toLowerCase();

    if (!siteName || !normalizedBoardName || !normalizedContentId || !normalizedCommentId) {
      return Response.json({ error: '요청 정보가 유효하지 않습니다.' }, { status: 400 });
    }

    const target = await getPinTarget({
      siteName,
      boardName: normalizedBoardName,
      contentId: normalizedContentId,
      commentId: normalizedCommentId,
    });

    if (target.error || !target.data) {
      return target.error;
    }

    if (isPinned && (target.data.comment.is_deleted || target.data.comment.is_blinded)) {
      return Response.json({ error: '삭제되었거나 숨김 처리된 댓글은 고정할 수 없습니다.' }, { status: 400 });
    }

    if (target.data.comment.parent_id) {
      return Response.json({ error: '답글은 고정할 수 없습니다.' }, { status: 400 });
    }

    const permission = await canPinComment({
      siteName,
      siteId: target.data.siteId,
      boardId: target.data.boardId,
      postAuthorId: target.data.postAuthorId,
    });

    if (!permission.session.authUserId || !permission.session.stigmaId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (!permission.allowed) {
      return Response.json({ error: '댓글을 고정할 권한이 없습니다.' }, { status: 403 });
    }

    const updateResult = await getSupabaseAdmin().rpc('set_post_comment_pin', {
      p_post_id: target.data.postId,
      p_comment_id: target.data.comment.id,
      p_is_pinned: isPinned,
      p_pinned_by: permission.session.stigmaId,
    });

    if (updateResult.error) {
      if (updateResult.error.message.includes('PINNABLE_COMMENT_NOT_FOUND')) {
        return Response.json({ error: '삭제되었거나 숨김 처리된 댓글은 고정할 수 없습니다.' }, { status: 400 });
      }

      return Response.json({ error: '댓글 고정 상태를 변경하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ ok: true, isPinned });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '댓글 고정 상태를 변경하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '댓글 고정 상태를 변경하지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  return updatePin(request, context, true);
}

export async function DELETE(request: Request, context: RouteContext) {
  return updatePin(request, context, false);
}
