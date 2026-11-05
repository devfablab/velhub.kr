import { getSupabaseAdmin } from '@/lib/clients/supabase';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';

export type CommentReactionRouteContext = {
  params: Promise<{
    boardName: string;
    contentId: string;
    commentId: string;
  }>;
};

type CommentReaction = 'like' | 'dislike';

function isNumericSlug(value: string) {
  return /^\d+$/.test(value);
}

async function getTargetComment({
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
  if (!siteName || !boardName || !contentId || !commentId) {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const rhizomeResult = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

  if (rhizomeResult.error || !rhizomeResult.data) {
    return null;
  }

  const boardResult = await supabaseAdmin
    .from('boards')
    .select('id, board_type')
    .eq('site_id', rhizomeResult.data.id)
    .eq('board_key', boardName)
    .maybeSingle();

  if (boardResult.error || !boardResult.data || boardResult.data.board_type === 'page') {
    return null;
  }

  const postQuery = supabaseAdmin
    .from('posts')
    .select('id, site_id, board_id, published_status, is_closed')
    .eq('site_id', rhizomeResult.data.id)
    .eq('board_id', boardResult.data.id);

  const postResult = isNumericSlug(contentId)
    ? await postQuery.eq('slug', contentId).maybeSingle()
    : await postQuery.eq('id', contentId).maybeSingle();

  if (postResult.error || !postResult.data) {
    return null;
  }

  const commentResult = await supabaseAdmin
    .from('post_comments')
    .select('id, site_id, board_id, post_id, is_deleted, is_blinded')
    .eq('id', commentId)
    .eq('site_id', rhizomeResult.data.id)
    .eq('board_id', boardResult.data.id)
    .eq('post_id', postResult.data.id)
    .maybeSingle();

  if (commentResult.error || !commentResult.data) {
    return null;
  }

  return {
    siteId: rhizomeResult.data.id as string,
    boardId: boardResult.data.id as string,
    postId: postResult.data.id as string,
    commentId: commentResult.data.id as string,
    isPublished: postResult.data.published_status === 'published',
    isClosed: postResult.data.is_closed === true,
    isDeleted: commentResult.data.is_deleted === true,
    isBlinded: commentResult.data.is_blinded === true,
  };
}

export async function toggleCommentReaction(
  request: Request,
  context: CommentReactionRouteContext,
  reaction: CommentReaction,
) {
  const reactionLabel = reaction === 'like' ? '좋아요' : '싫어요';

  try {
    const { boardName, contentId, commentId } = await context.params;
    const requestUrl = new URL(request.url);
    const targetComment = await getTargetComment({
      siteName: normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase(),
      boardName: normalizeText(boardName).toLowerCase(),
      contentId: normalizeText(contentId),
      commentId: normalizeText(commentId),
    });

    if (!targetComment) {
      return Response.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({ siteId: targetComment.siteId });

    if (!session.authUserId || !session.stigmaId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (!targetComment.isPublished || targetComment.isClosed || targetComment.isDeleted || targetComment.isBlinded) {
      return Response.json({ error: `${reactionLabel}를 처리할 수 없는 댓글입니다.` }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const existingResult =
      reaction === 'like'
        ? await supabaseAdmin
            .from('comment_likes')
            .select('id')
            .eq('user_id', session.stigmaId)
            .eq('site_id', targetComment.siteId)
            .eq('board_id', targetComment.boardId)
            .eq('post_id', targetComment.postId)
            .eq('comment_id', targetComment.commentId)
            .limit(1)
        : await supabaseAdmin
            .from('comment_dislikes')
            .select('id')
            .eq('user_id', session.stigmaId)
            .eq('site_id', targetComment.siteId)
            .eq('board_id', targetComment.boardId)
            .eq('post_id', targetComment.postId)
            .eq('comment_id', targetComment.commentId)
            .limit(1);

    if (existingResult.error) {
      return Response.json({ error: `댓글 ${reactionLabel} 상태를 확인하지 못했습니다.` }, { status: 500 });
    }

    const isActive = (existingResult.data ?? []).length > 0;

    if (isActive) {
      const deleteResult =
        reaction === 'like'
          ? await supabaseAdmin
              .from('comment_likes')
              .delete()
              .eq('user_id', session.stigmaId)
              .eq('site_id', targetComment.siteId)
              .eq('board_id', targetComment.boardId)
              .eq('post_id', targetComment.postId)
              .eq('comment_id', targetComment.commentId)
          : await supabaseAdmin
              .from('comment_dislikes')
              .delete()
              .eq('user_id', session.stigmaId)
              .eq('site_id', targetComment.siteId)
              .eq('board_id', targetComment.boardId)
              .eq('post_id', targetComment.postId)
              .eq('comment_id', targetComment.commentId);

      if (deleteResult.error) {
        return Response.json({ error: `댓글 ${reactionLabel}를 취소하지 못했습니다.` }, { status: 500 });
      }
    } else {
      const removeOppositeResult =
        reaction === 'like'
          ? await supabaseAdmin
              .from('comment_dislikes')
              .delete()
              .eq('user_id', session.stigmaId)
              .eq('site_id', targetComment.siteId)
              .eq('board_id', targetComment.boardId)
              .eq('post_id', targetComment.postId)
              .eq('comment_id', targetComment.commentId)
          : await supabaseAdmin
              .from('comment_likes')
              .delete()
              .eq('user_id', session.stigmaId)
              .eq('site_id', targetComment.siteId)
              .eq('board_id', targetComment.boardId)
              .eq('post_id', targetComment.postId)
              .eq('comment_id', targetComment.commentId);

      if (removeOppositeResult.error) {
        return Response.json({ error: `댓글 ${reactionLabel}를 처리하지 못했습니다.` }, { status: 500 });
      }

      const reactionRow = {
        user_id: session.stigmaId,
        site_id: targetComment.siteId,
        board_id: targetComment.boardId,
        post_id: targetComment.postId,
        comment_id: targetComment.commentId,
      };
      const insertResult =
        reaction === 'like'
          ? await supabaseAdmin.from('comment_likes').insert(reactionRow)
          : await supabaseAdmin.from('comment_dislikes').insert(reactionRow);

      if (insertResult.error) {
        return Response.json({ error: `댓글 ${reactionLabel}를 저장하지 못했습니다.` }, { status: 500 });
      }
    }

    const [likeCountResult, dislikeCountResult] = await Promise.all([
      supabaseAdmin
        .from('comment_likes')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', targetComment.siteId)
        .eq('board_id', targetComment.boardId)
        .eq('post_id', targetComment.postId)
        .eq('comment_id', targetComment.commentId),
      supabaseAdmin
        .from('comment_dislikes')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', targetComment.siteId)
        .eq('board_id', targetComment.boardId)
        .eq('post_id', targetComment.postId)
        .eq('comment_id', targetComment.commentId),
    ]);

    if (likeCountResult.error || dislikeCountResult.error) {
      return Response.json({ error: '댓글 반응 수를 확인하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      isLiked: reaction === 'like' ? !isActive : false,
      likeCount: likeCountResult.count ?? 0,
      isDisliked: reaction === 'dislike' ? !isActive : false,
      dislikeCount: dislikeCountResult.count ?? 0,
    });
  } catch (unknownError) {
    const fallbackMessage = `댓글 ${reactionLabel}를 처리하지 못했습니다.`;
    return Response.json(
      { error: unknownError instanceof Error ? unknownError.message || fallbackMessage : fallbackMessage },
      { status: 500 },
    );
  }
}
