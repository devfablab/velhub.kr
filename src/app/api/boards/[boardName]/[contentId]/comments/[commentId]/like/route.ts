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
    ? await postQuery.eq('slug', Number(contentId)).maybeSingle()
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

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { boardName, contentId, commentId } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const normalizedContentId = normalizeText(contentId);
    const normalizedCommentId = normalizeText(commentId);

    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    const targetComment = await getTargetComment({
      siteName,
      boardName: normalizedBoardName,
      contentId: normalizedContentId,
      commentId: normalizedCommentId,
    });

    if (!targetComment) {
      return Response.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: targetComment.siteId,
    });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (!targetComment.isPublished || targetComment.isClosed || targetComment.isDeleted || targetComment.isBlinded) {
      return Response.json({ error: '좋아요를 처리할 수 없는 댓글입니다.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const existingResult = await supabaseAdmin
      .from('comment_likes')
      .select('id')
      .eq('user_id', session.authUserId)
      .eq('site_id', targetComment.siteId)
      .eq('board_id', targetComment.boardId)
      .eq('post_id', targetComment.postId)
      .eq('comment_id', targetComment.commentId)
      .limit(1);

    if (existingResult.error) {
      return Response.json({ error: '댓글 좋아요 상태를 확인하지 못했습니다.' }, { status: 500 });
    }

    const isLiked = (existingResult.data ?? []).length > 0;

    if (isLiked) {
      const deleteResult = await supabaseAdmin
        .from('comment_likes')
        .delete()
        .eq('user_id', session.authUserId)
        .eq('site_id', targetComment.siteId)
        .eq('board_id', targetComment.boardId)
        .eq('post_id', targetComment.postId)
        .eq('comment_id', targetComment.commentId);

      if (deleteResult.error) {
        return Response.json({ error: '댓글 좋아요를 취소하지 못했습니다.' }, { status: 500 });
      }
    } else {
      const insertResult = await supabaseAdmin.from('comment_likes').insert({
        user_id: session.authUserId,
        site_id: targetComment.siteId,
        board_id: targetComment.boardId,
        post_id: targetComment.postId,
        comment_id: targetComment.commentId,
      });

      if (insertResult.error) {
        return Response.json({ error: '댓글 좋아요를 저장하지 못했습니다.' }, { status: 500 });
      }
    }

    const countResult = await supabaseAdmin
      .from('comment_likes')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', targetComment.siteId)
      .eq('board_id', targetComment.boardId)
      .eq('post_id', targetComment.postId)
      .eq('comment_id', targetComment.commentId);

    if (countResult.error) {
      return Response.json({ error: '댓글 좋아요 수를 확인하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      isLiked: !isLiked,
      likeCount: countResult.count ?? 0,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '댓글 좋아요를 처리하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '댓글 좋아요를 처리하지 못했습니다.' }, { status: 500 });
  }
}
