import verifySession from '@/lib/session/verifySession';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
    contentId: string;
  }>;
};

type PatchRequestBody = {
  action?: 'close' | 'restore' | null;
  closedMessage?: string | null;
};

function normalizeClosedMessage(value: string | null | undefined) {
  return (value ?? '').trim();
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { boardName, contentId } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const normalizedContentId = normalizeText(contentId);

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!normalizedContentId) {
      return Response.json({ error: 'contentId가 유효하지 않습니다.' }, { status: 400 });
    }

    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestBody = (await request.json()) as PatchRequestBody;
    const action = requestBody.action;
    const closedMessage = normalizeClosedMessage(requestBody.closedMessage);

    if (action !== 'close' && action !== 'restore') {
      return Response.json({ error: 'action이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id, site_type').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    const isStaff = session.status !== 'FAIL' && session.case === 'staff';

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_type')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (board.data.board_type === 'page') {
      return Response.json({ error: '페이지는 이 경로에서 처리할 수 없습니다.' }, { status: 400 });
    }

    const post = await supabaseAdmin
      .from('posts')
      .select('id, user_id, is_closed, closed_by, closed_message')
      .eq('board_id', board.data.id)
      .eq('slug', normalizedContentId)
      .maybeSingle();

    if (post.error || !post.data) {
      return Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const isAuthor = post.data.user_id === sessionClaims.userId;

    if (action === 'close') {
      if (rhizome.data.site_type === 'blog') {
        if (!isAuthor && !isStaff) {
          return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
        }
      } else {
        if (!isStaff) {
          return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
        }
      }

      if (post.data.is_closed === true) {
        return Response.json({ error: '이미 삭제된 게시물입니다.' }, { status: 400 });
      }

      if (isStaff && closedMessage.length < 10) {
        return Response.json({ error: '삭제 사유를 10자 이상 입력해주세요.' }, { status: 400 });
      }

      const closeResult = await supabaseAdmin
        .from('posts')
        .update({
          is_closed: true,
          closed_by: sessionClaims.userId,
          closed_at: new Date().toISOString(),
          closed_message: isStaff ? closedMessage : null,
        })
        .eq('id', post.data.id)
        .select('id, is_closed, closed_by, closed_at, closed_message')
        .maybeSingle();

      if (closeResult.error || !closeResult.data) {
        return Response.json({ error: '게시물 삭제에 실패했습니다.' }, { status: 500 });
      }

      return Response.json({
        ok: true,
        post: closeResult.data,
      });
    }

    if (!isStaff) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (post.data.is_closed !== true) {
      return Response.json({ error: '삭제된 게시물이 아닙니다.' }, { status: 400 });
    }

    const isSelfDeleted = post.data.closed_by === post.data.user_id;
    const isRecoverable =
      !isSelfDeleted ||
      (isSelfDeleted &&
        typeof post.data.closed_message === 'string' &&
        normalizeClosedMessage(post.data.closed_message).length >= 10);

    if (!isRecoverable) {
      return Response.json({ error: '이 게시물은 복구할 수 없습니다.' }, { status: 400 });
    }

    const restoreResult = await supabaseAdmin
      .from('posts')
      .update({
        is_closed: false,
        closed_by: null,
        closed_at: null,
        closed_message: null,
      })
      .eq('id', post.data.id)
      .select('id, is_closed, closed_by, closed_at, closed_message')
      .maybeSingle();

    if (restoreResult.error || !restoreResult.data) {
      return Response.json({ error: '게시물 복구에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      post: restoreResult.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시물 처리에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시물 처리에 실패했습니다.' }, { status: 500 });
  }
}
