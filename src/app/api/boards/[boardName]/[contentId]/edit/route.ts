import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type RouteContext = {
  params: Promise<{
    boardName: string;
    contentId: string;
  }>;
};

type RequestBody = {
  siteName: string | null;
  slug?: string | null;
  subject: string | null;
  summary: string | null;
  contentHtml: string | null;
  contentMarkdown: string | null;
  ogImage?: string | null;
  attachmentSlug?: string | null;
  attachmentOrigin?: string | null;
  isComment?: boolean | null;
  thumbnailImage?: string | null;
  thumbnailWidth?: number | string | null;
  thumbnailHeight?: number | string | null;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function normalizeNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      return null;
    }

    const parsedValue = Number(normalizedValue);

    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { boardName, contentId } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const normalizedContentId = normalizeText(contentId);

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!normalizedContentId) {
      return Response.json({ error: 'contentId가 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const subject = normalizeText(requestBody.subject);
    const summary = normalizeText(requestBody.summary);
    const contentHtml = requestBody.contentHtml ?? '';
    const contentMarkdown = requestBody.contentMarkdown ?? '';
    const ogImage = normalizeText(requestBody.ogImage);
    const attachmentSlug = normalizeText(requestBody.attachmentSlug);
    const attachmentOrigin = normalizeText(requestBody.attachmentOrigin);
    const isComment = requestBody.isComment;
    const thumbnailImage = normalizeText(requestBody.thumbnailImage);
    const thumbnailWidth = normalizeNumber(requestBody.thumbnailWidth);
    const thumbnailHeight = normalizeNumber(requestBody.thumbnailHeight);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!subject) {
      return Response.json({ error: '제목을 입력해주세요.' }, { status: 400 });
    }

    if (!contentHtml.trim()) {
      return Response.json({ error: '내용을 입력해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error || !stigmaResult.data) {
      return Response.json({ error: '사용자 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const rhizomeResult = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (rhizomeResult.error || !rhizomeResult.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const manageResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('role')
      .eq('site_id', rhizomeResult.data.id)
      .eq('user_id', stigmaResult.data.id)
      .in('role', ['owner', 'manager'])
      .maybeSingle();

    if (manageResult.error || !manageResult.data) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const boardResult = await supabaseAdmin
      .from('boards')
      .select('id, board_type')
      .eq('site_id', rhizomeResult.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (boardResult.error || !boardResult.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (boardResult.data.board_type === 'page') {
      if (!normalizedContentId) {
        return Response.json({ error: 'contentId가 유효하지 않습니다.' }, { status: 400 });
      }

      if (!normalizeText(requestBody.slug)) {
        return Response.json({ error: '페이지 식별자를 입력해주세요.' }, { status: 400 });
      }

      if (attachmentSlug && !attachmentOrigin) {
        return Response.json({ error: '첨부파일 원본 이름을 확인해주세요.' }, { status: 400 });
      }

      if (typeof isComment !== 'boolean') {
        return Response.json({ error: '댓글 쓰기 허용 값을 확인해주세요.' }, { status: 400 });
      }

      const currentPageResult = await supabaseAdmin
        .from('pages')
        .select('id, user_id')
        .eq('board_id', boardResult.data.id)
        .eq('slug', normalizedContentId)
        .maybeSingle();

      if (currentPageResult.error || !currentPageResult.data) {
        return Response.json({ error: '페이지를 찾을 수 없습니다.' }, { status: 404 });
      }

      if (currentPageResult.data.user_id !== sessionClaims.userId) {
        return Response.json({ error: '작성자만 수정할 수 있습니다.' }, { status: 403 });
      }

      const updatePageResult = await supabaseAdmin
        .from('pages')
        .update({
          slug: normalizeText(requestBody.slug),
          subject,
          summary: summary || null,
          content_html: contentHtml,
          content_markdown: contentMarkdown || null,
          edited_at: new Date().toISOString(),
          og_image: ogImage || null,
          attachment_slug: attachmentSlug || null,
          attachment_origin: attachmentOrigin || null,
          is_comment: isComment,
        })
        .eq('id', currentPageResult.data.id);

      if (updatePageResult.error) {
        return Response.json({ error: '페이지 수정에 실패했습니다.' }, { status: 500 });
      }

      return Response.json({
        ok: true,
        slug: normalizeText(requestBody.slug),
      });
    }

    if (boardResult.data.board_type === 'blog') {
      const currentPostResult = await supabaseAdmin
        .from('posts')
        .select('id, user_id, slug')
        .eq('board_id', boardResult.data.id)
        .eq('slug', normalizedContentId)
        .maybeSingle();

      if (currentPostResult.error || !currentPostResult.data) {
        return Response.json({ error: '블로그 글을 찾을 수 없습니다.' }, { status: 404 });
      }

      if (currentPostResult.data.user_id !== sessionClaims.userId) {
        return Response.json({ error: '작성자만 수정할 수 있습니다.' }, { status: 403 });
      }

      const updatePostResult = await supabaseAdmin
        .from('posts')
        .update({
          subject,
          summary: summary || null,
          content_html: contentHtml,
          content_markdown: contentMarkdown || null,
          edited_at: new Date().toISOString(),
          thumbnail_image: thumbnailImage || null,
          thumbnail_width: thumbnailWidth,
          thumbnail_height: thumbnailHeight,
        })
        .eq('id', currentPostResult.data.id);

      if (updatePostResult.error) {
        return Response.json({ error: '블로그 글 수정에 실패했습니다.' }, { status: 500 });
      }

      return Response.json({
        ok: true,
        slug: currentPostResult.data.slug,
      });
    }

    return Response.json({ error: '지원하지 않는 게시판 종류입니다.' }, { status: 400 });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '콘텐츠 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '콘텐츠 수정에 실패했습니다.' }, { status: 500 });
  }
}
