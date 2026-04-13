import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type RouteContext = {
  params: Promise<{
    boardName: string;
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

export async function POST(request: Request, context: RouteContext) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { boardName } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const slug = normalizeText(requestBody.slug);
    const subject = normalizeText(requestBody.subject);
    const summary = normalizeText(requestBody.summary);
    const contentHtml = requestBody.contentHtml ?? '';
    const contentMarkdown = requestBody.contentMarkdown ?? '';
    const ogImage = normalizeText(requestBody.ogImage);
    const attachmentSlug = normalizeText(requestBody.attachmentSlug);
    const attachmentOrigin = normalizeText(requestBody.attachmentOrigin);
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

    const rhizomeResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_type')
      .eq('site_key', siteName)
      .maybeSingle();

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
      .select('id, board_key, board_type')
      .eq('site_id', rhizomeResult.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (boardResult.error || !boardResult.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (boardResult.data.board_type === 'page') {
      if (!slug) {
        return Response.json({ error: '페이지 식별자를 입력해주세요.' }, { status: 400 });
      }

      if (attachmentSlug && !attachmentOrigin) {
        return Response.json({ error: '첨부파일 원본 이름을 확인해주세요.' }, { status: 400 });
      }

      const sortOrderResult = await supabaseAdmin
        .from('pages')
        .select('sort_order')
        .eq('board_id', boardResult.data.id)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sortOrderResult.error) {
        return Response.json({ error: '페이지 정렬값 확인에 실패했습니다.' }, { status: 500 });
      }

      const nextSortOrder =
        typeof sortOrderResult.data?.sort_order === 'number' ? sortOrderResult.data.sort_order + 1 : 1;

      const insertPageResult = await supabaseAdmin
        .from('pages')
        .insert({
          slug,
          subject,
          summary: summary || null,
          content_html: contentHtml,
          content_markdown: contentMarkdown || null,
          edited_at: new Date().toISOString(),
          og_image: ogImage || null,
          attachment_slug: attachmentSlug || null,
          attachment_origin: attachmentOrigin || null,
          sort_order: nextSortOrder,
          user_id: sessionClaims.userId,
          site_id: rhizomeResult.data.id,
          board_id: boardResult.data.id,
          is_comment: false,
        })
        .select('id')
        .maybeSingle();

      if (insertPageResult.error || !insertPageResult.data) {
        return Response.json({ error: '페이지 생성에 실패했습니다.' }, { status: 500 });
      }

      return Response.json({
        ok: true,
        pageId: insertPageResult.data.id,
        slug,
        boardId: boardResult.data.id,
      });
    }

    if (boardResult.data.board_type === 'blog') {
      if (rhizomeResult.data.site_type !== 'blog') {
        return Response.json({ error: '블로그 사이트만 접근할 수 있습니다.' }, { status: 403 });
      }

      const idxResult = await supabaseAdmin
        .from('posts')
        .select('idx')
        .eq('board_id', boardResult.data.id)
        .order('idx', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (idxResult.error) {
        return Response.json({ error: '블로그 글 순번 확인에 실패했습니다.' }, { status: 500 });
      }

      const nextIdx = typeof idxResult.data?.idx === 'number' ? idxResult.data.idx + 1 : 1;

      let nextSlug = '';
      let hasDuplicateSlug = true;

      while (hasDuplicateSlug) {
        nextSlug = String(Math.floor(Math.random() * 10000000000)).padStart(10, '0');

        const duplicateSlugResult = await supabaseAdmin
          .from('posts')
          .select('id')
          .eq('board_id', boardResult.data.id)
          .eq('slug', Number(nextSlug))
          .maybeSingle();

        if (duplicateSlugResult.error) {
          return Response.json({ error: '블로그 글 식별자 확인에 실패했습니다.' }, { status: 500 });
        }

        hasDuplicateSlug = Boolean(duplicateSlugResult.data);
      }

      const insertPostResult = await supabaseAdmin
        .from('posts')
        .insert({
          user_id: sessionClaims.userId,
          slug: Number(nextSlug),
          content_html: contentHtml,
          content_markdown: contentMarkdown || null,
          subject,
          summary: summary || null,
          edited_at: new Date().toISOString(),
          thumbnail_image: thumbnailImage || null,
          thumbnail_width: thumbnailWidth,
          thumbnail_height: thumbnailHeight,
          idx: nextIdx,
          board_id: boardResult.data.id,
          site_id: rhizomeResult.data.id,
        })
        .select('id, slug, idx')
        .maybeSingle();

      if (insertPostResult.error || !insertPostResult.data) {
        return Response.json({ error: '블로그 글 생성에 실패했습니다.' }, { status: 500 });
      }

      return Response.json({
        ok: true,
        postId: insertPostResult.data.id,
        slug: String(insertPostResult.data.slug),
        idx: insertPostResult.data.idx,
        boardId: boardResult.data.id,
      });
    }

    return Response.json({ error: '지원하지 않는 게시판 종류입니다.' }, { status: 400 });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '콘텐츠 생성에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '콘텐츠 생성에 실패했습니다.' }, { status: 500 });
  }
}
