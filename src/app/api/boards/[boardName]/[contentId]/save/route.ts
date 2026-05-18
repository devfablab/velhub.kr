import { NextResponse } from 'next/server';
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

  const rhizomeResult = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

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
    .select('id, site_id, board_id, published_status, is_closed')
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
      return NextResponse.json({ error: '저장할 수 없는 글입니다.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const existingResult = await supabaseAdmin
      .from('post_saves')
      .select('id')
      .eq('user_id', session.authUserId)
      .eq('site_id', targetPost.siteId)
      .eq('board_id', targetPost.boardId)
      .eq('post_id', targetPost.postId)
      .limit(1);

    if (existingResult.error) {
      return NextResponse.json({ error: '저장 상태를 확인하지 못했습니다.' }, { status: 500 });
    }

    const isSaved = (existingResult.data ?? []).length > 0;

    if (isSaved) {
      const deleteResult = await supabaseAdmin
        .from('post_saves')
        .delete()
        .eq('user_id', session.authUserId)
        .eq('site_id', targetPost.siteId)
        .eq('board_id', targetPost.boardId)
        .eq('post_id', targetPost.postId);

      if (deleteResult.error) {
        return NextResponse.json({ error: '저장을 취소하지 못했습니다.' }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        isSaved: false,
      });
    }

    const insertResult = await supabaseAdmin.from('post_saves').insert({
      user_id: session.authUserId,
      site_id: targetPost.siteId,
      board_id: targetPost.boardId,
      post_id: targetPost.postId,
    });

    if (insertResult.error) {
      return NextResponse.json({ error: '글을 저장하지 못했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      isSaved: true,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return NextResponse.json({ error: unknownError.message || '글 저장을 처리하지 못했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ error: '글 저장을 처리하지 못했습니다.' }, { status: 500 });
  }
}
