import { getSessionClaims } from '@/lib/session';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
    contentId: string;
  }>;
};

type RequestBody = {
  siteName?: string | null;
  subject?: string | null;
  summary?: string | null;
  contentHtml?: string | null;
  contentMarkdown?: string | null;
  thumbnailImage?: string | null;
  thumbnailWidth?: number | null;
  thumbnailHeight?: number | null;
  isClosed?: boolean | null;
};

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

    const requestUrl = new URL(request.url);
    const requestBody = (await request.json()) as RequestBody;

    const siteNameFromQuery = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const siteNameFromBody = normalizeText(requestBody.siteName).toLowerCase();
    const siteName = siteNameFromBody || siteNameFromQuery;

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

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
      return Response.json({ error: '페이지 수정은 이 경로에서 처리할 수 없습니다.' }, { status: 400 });
    }

    const post = await supabaseAdmin
      .from('posts')
      .select('id, user_id, is_closed')
      .eq('board_id', board.data.id)
      .eq('slug', normalizedContentId)
      .maybeSingle();

    if (post.error || !post.data) {
      return Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const isAuthor = post.data.user_id === sessionClaims.userId;

    if (!isAuthor && !isStaff) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const hasIsClosed = typeof requestBody.isClosed === 'boolean';
    const hasContentFields =
      requestBody.subject !== undefined ||
      requestBody.summary !== undefined ||
      requestBody.contentHtml !== undefined ||
      requestBody.contentMarkdown !== undefined ||
      requestBody.thumbnailImage !== undefined ||
      requestBody.thumbnailWidth !== undefined ||
      requestBody.thumbnailHeight !== undefined;

    if (isStaff && !isAuthor) {
      if (!hasIsClosed || hasContentFields) {
        return Response.json({ error: '스텝은 비공개 상태만 변경할 수 있습니다.' }, { status: 403 });
      }

      const updateClosedResult = await supabaseAdmin
        .from('posts')
        .update({
          is_closed: Boolean(requestBody.isClosed),
        })
        .eq('id', post.data.id);

      if (updateClosedResult.error) {
        return Response.json({ error: '공개 상태 변경에 실패했습니다.' }, { status: 500 });
      }

      return Response.json({
        ok: true,
        isClosed: Boolean(requestBody.isClosed),
      });
    }

    const subject = requestBody.subject !== undefined ? normalizeText(requestBody.subject) : undefined;
    const summary = requestBody.summary !== undefined ? normalizeText(requestBody.summary) : undefined;
    const contentHtml = requestBody.contentHtml !== undefined ? (requestBody.contentHtml ?? '') : undefined;
    const contentMarkdown = requestBody.contentMarkdown !== undefined ? (requestBody.contentMarkdown ?? '') : undefined;
    const thumbnailImage =
      requestBody.thumbnailImage !== undefined ? normalizeText(requestBody.thumbnailImage) || null : undefined;
    const thumbnailWidth = requestBody.thumbnailWidth !== undefined ? (requestBody.thumbnailWidth ?? null) : undefined;
    const thumbnailHeight =
      requestBody.thumbnailHeight !== undefined ? (requestBody.thumbnailHeight ?? null) : undefined;

    const updatePayload: {
      subject?: string;
      summary?: string | null;
      content_html?: string;
      content_markdown?: string | null;
      thumbnail_image?: string | null;
      thumbnail_width?: number | null;
      thumbnail_height?: number | null;
      edited_at?: string;
      is_closed?: boolean;
    } = {};

    if (subject !== undefined) {
      if (!subject) {
        return Response.json({ error: '제목을 입력해주세요.' }, { status: 400 });
      }

      updatePayload.subject = subject;
    }

    if (summary !== undefined) {
      updatePayload.summary = summary || null;
    }

    if (contentHtml !== undefined) {
      if (!contentHtml.trim()) {
        return Response.json({ error: '내용을 입력해주세요.' }, { status: 400 });
      }

      updatePayload.content_html = contentHtml;
    }

    if (contentMarkdown !== undefined) {
      updatePayload.content_markdown = contentMarkdown.trim() ? contentMarkdown : null;
    }

    if (thumbnailImage !== undefined) {
      updatePayload.thumbnail_image = thumbnailImage;
    }

    if (thumbnailWidth !== undefined) {
      updatePayload.thumbnail_width = thumbnailWidth;
    }

    if (thumbnailHeight !== undefined) {
      updatePayload.thumbnail_height = thumbnailHeight;
    }

    if (hasIsClosed) {
      updatePayload.is_closed = Boolean(requestBody.isClosed);
    }

    updatePayload.edited_at = new Date().toISOString();

    const updateResult = await supabaseAdmin.from('posts').update(updatePayload).eq('id', post.data.id);

    if (updateResult.error) {
      return Response.json({ error: '글 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      isClosed: hasIsClosed ? Boolean(requestBody.isClosed) : post.data.is_closed,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '글 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '글 수정에 실패했습니다.' }, { status: 500 });
  }
}
