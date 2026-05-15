import verifySession from '@/lib/session/verifySession';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { getNextSeriesIdx, reorderSeriesIdx } from '@/lib/board/seriesIdx';

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

function isNumericSlug(value: string) {
  return /^\d+$/.test(value);
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

    const isStaff = session.case === 'staff';

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
      if (!isStaff) {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }

      const pageQuery = supabaseAdmin.from('pages').select('*').eq('board_id', board.data.id);

      const page = await pageQuery.eq('slug', normalizedContentId).maybeSingle();

      if (page.error || !page.data) {
        return Response.json({ error: '페이지를 찾을 수 없습니다.' }, { status: 404 });
      }

      if (action === 'close') {
        if (page.data.is_closed === true) {
          return Response.json({ error: '이미 삭제된 페이지입니다.' }, { status: 400 });
        }

        const closeResult = await supabaseAdmin
          .from('pages')
          .update({
            is_closed: true,
            closed_by: sessionClaims.userId,
            closed_at: new Date().toISOString(),
            closed_message: null,
          })
          .eq('id', page.data.id)
          .select('id, is_closed, closed_by, closed_at, closed_message')
          .maybeSingle();

        if (closeResult.error || !closeResult.data) {
          return Response.json({ error: '페이지 삭제에 실패했습니다.' }, { status: 500 });
        }

        return Response.json({
          ok: true,
          content: closeResult.data,
        });
      }

      if (page.data.is_closed !== true) {
        return Response.json({ error: '삭제된 페이지가 아닙니다.' }, { status: 400 });
      }

      const restoreResult = await supabaseAdmin
        .from('pages')
        .update({
          is_closed: false,
          closed_by: null,
          closed_at: null,
          closed_message: null,
        })
        .eq('id', page.data.id)
        .select('id, is_closed, closed_by, closed_at, closed_message')
        .maybeSingle();

      if (restoreResult.error || !restoreResult.data) {
        return Response.json({ error: '페이지 복구에 실패했습니다.' }, { status: 500 });
      }

      return Response.json({
        ok: true,
        content: restoreResult.data,
      });
    }

    const postQuery = supabaseAdmin.from('posts').select('*').eq('board_id', board.data.id);

    const post = isNumericSlug(normalizedContentId)
      ? await postQuery.eq('slug', Number(normalizedContentId)).maybeSingle()
      : await postQuery.eq('id', normalizedContentId).maybeSingle();

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
          series_idx: null,
        })
        .eq('id', post.data.id)
        .select('id, is_closed, closed_by, closed_at, closed_message')
        .maybeSingle();

      if (closeResult.error || !closeResult.data) {
        return Response.json({ error: '게시물 삭제에 실패했습니다.' }, { status: 500 });
      }

      if (post.data.series_id && post.data.published_status === 'published') {
        await reorderSeriesIdx({
          siteId: rhizome.data.id,
          boardId: board.data.id,
          seriesId: post.data.series_id,
        });
      }

      return Response.json({
        ok: true,
        content: closeResult.data,
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

    const restoredSeriesIdx =
      post.data.series_id && post.data.published_status === 'published'
        ? await getNextSeriesIdx({
            siteId: rhizome.data.id,
            boardId: board.data.id,
            seriesId: post.data.series_id,
          })
        : null;

    const restoreResult = await supabaseAdmin
      .from('posts')
      .update({
        is_closed: false,
        closed_by: null,
        closed_at: null,
        closed_message: null,
        series_idx: restoredSeriesIdx,
      })
      .eq('id', post.data.id)
      .select('id, is_closed, closed_by, closed_at, closed_message')
      .maybeSingle();

    if (restoreResult.error || !restoreResult.data) {
      return Response.json({ error: '게시물 복구에 실패했습니다.' }, { status: 500 });
    }

    if (post.data.series_id && post.data.published_status === 'published') {
      await reorderSeriesIdx({
        siteId: rhizome.data.id,
        boardId: board.data.id,
        seriesId: post.data.series_id,
      });
    }

    return Response.json({
      ok: true,
      content: restoreResult.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '콘텐츠 처리에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '콘텐츠 처리에 실패했습니다.' }, { status: 500 });
  }
}
