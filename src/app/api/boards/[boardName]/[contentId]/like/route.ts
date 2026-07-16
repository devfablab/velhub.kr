import { NextResponse } from 'next/server';
import { NOTIFICATION_TYPE } from '@/lib/notifications/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
    contentId: string;
  }>;
};

function isNumericSlug(value: string) {
  return /^\d+$/.test(value);
}

async function getTargetPost({
  siteName,
  boardName,
  contentId,
}: {
  siteName: string;
  boardName: string;
  contentId: string;
}) {
  if (!siteName || !boardName || !contentId || !isNumericSlug(contentId)) {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const rhizomeResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, visibility_type, is_shutdown')
    .eq('site_key', siteName)
    .maybeSingle();

  if (rhizomeResult.error || !rhizomeResult.data) {
    return null;
  }

  const boardResult = await supabaseAdmin
    .from('boards')
    .select('id')
    .eq('site_id', rhizomeResult.data.id)
    .eq('board_key', boardName)
    .maybeSingle();

  if (boardResult.error || !boardResult.data) {
    return null;
  }

  const postResult = await supabaseAdmin
    .from('posts')
    .select('id, site_id, board_id, user_id, published_status, is_closed')
    .eq('site_id', rhizomeResult.data.id)
    .eq('board_id', boardResult.data.id)
    .eq('slug', Number(contentId))
    .maybeSingle();

  if (postResult.error || !postResult.data) {
    return null;
  }

  return {
    siteId: rhizomeResult.data.id as string,
    boardId: boardResult.data.id as string,
    postId: postResult.data.id as string,
    postAuthorId: postResult.data.user_id as string,
    publishedStatus: postResult.data.published_status as string,
    isClosed: postResult.data.is_closed === true,
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { boardName, contentId } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const normalizedContentId = normalizeText(contentId);
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    const targetPost = await getTargetPost({
      siteName,
      boardName: normalizedBoardName,
      contentId: normalizedContentId,
    });

    if (!targetPost) {
      return NextResponse.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: targetPost.siteId,
    });

    if (!session.authUserId) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (targetPost.publishedStatus !== 'published' || targetPost.isClosed) {
      return NextResponse.json({ error: '좋아요를 처리할 수 없는 글입니다.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const existingResult = await supabaseAdmin
      .from('post_likes')
      .select('id')
      .eq('user_id', session.authUserId)
      .eq('site_id', targetPost.siteId)
      .eq('board_id', targetPost.boardId)
      .eq('post_id', targetPost.postId)
      .limit(1);

    if (existingResult.error) {
      return NextResponse.json({ error: '좋아요 상태를 확인하지 못했습니다.' }, { status: 500 });
    }

    const isLiked = (existingResult.data ?? []).length > 0;

    if (isLiked) {
      const deleteResult = await supabaseAdmin
        .from('post_likes')
        .delete()
        .eq('user_id', session.authUserId)
        .eq('site_id', targetPost.siteId)
        .eq('board_id', targetPost.boardId)
        .eq('post_id', targetPost.postId);

      if (deleteResult.error) {
        return NextResponse.json({ error: '좋아요를 취소하지 못했습니다.' }, { status: 500 });
      }
    } else {
      const insertResult = await supabaseAdmin.from('post_likes').insert({
        user_id: session.authUserId,
        site_id: targetPost.siteId,
        board_id: targetPost.boardId,
        post_id: targetPost.postId,
      });

      if (insertResult.error) {
        return NextResponse.json({ error: '좋아요를 저장하지 못했습니다.' }, { status: 500 });
      }

      if (targetPost.postAuthorId !== session.authUserId) {
        const notificationResult = await supabaseAdmin.from('notifications').insert({
          user_id: targetPost.postAuthorId,
          send_user_id: session.authUserId,
          send_site_id: targetPost.siteId,
          send_board_id: targetPost.boardId,
          send_series_id: null,
          send_post_id: targetPost.postId,
          notification_type: NOTIFICATION_TYPE.POST_LIKED,
          is_read: false,
        });

        if (notificationResult.error) {
          console.error('[post-like] notification insert error', notificationResult.error);
        }
      }
    }

    const countResult = await supabaseAdmin
      .from('post_likes')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('site_id', targetPost.siteId)
      .eq('board_id', targetPost.boardId)
      .eq('post_id', targetPost.postId);

    if (countResult.error) {
      return NextResponse.json({ error: '좋아요 수를 확인하지 못했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      isLiked: !isLiked,
      likeCount: countResult.count ?? 0,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return NextResponse.json({ error: unknownError.message || '좋아요를 처리하지 못했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ error: '좋아요를 처리하지 못했습니다.' }, { status: 500 });
  }
}
