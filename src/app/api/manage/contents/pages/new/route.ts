import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RequestBody = {
  siteName: string | null;
  slug: string | null;
  subject: string | null;
  summary: string | null;
  contentHtml: string | null;
  contentMarkdown: string | null;
  ogImage: string | null;
  attachmentSlug: string | null;
  attachmentOrigin: string | null;
};

export async function POST(request: Request) {
  try {
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

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!slug) {
      return Response.json({ error: '페이지 식별자를 입력해주세요.' }, { status: 400 });
    }

    if (!subject) {
      return Response.json({ error: '페이지 제목을 입력해주세요.' }, { status: 400 });
    }

    if (!contentHtml.trim()) {
      return Response.json({ error: '페이지 내용을 입력해주세요.' }, { status: 400 });
    }

    if (attachmentSlug && !attachmentOrigin) {
      return Response.json({ error: '첨부파일 원본 이름을 확인해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (!session.authUserId) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const page = await supabaseAdmin.rpc('create_page_with_board', {
      p_site_id: rhizome.data.id,
      p_user_id: session.authUserId,
      p_slug: slug,
      p_subject: subject,
      p_summary: summary || null,
      p_content_html: contentHtml,
      p_content_markdown: contentMarkdown || null,
      p_edited_at: new Date().toISOString(),
      p_og_image: ogImage || null,
      p_attachment_slug: attachmentSlug || null,
      p_attachment_origin: attachmentOrigin || null,
    });

    if (page.error || !Array.isArray(page.data) || !page.data[0]) {
      return Response.json({ error: page.error?.message || '페이지 추가에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      boardId: page.data[0].board_id,
      pageId: page.data[0].page_id,
      createdBoard: page.data[0].created_board,
      slug,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '페이지 추가에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '페이지 추가에 실패했습니다.' }, { status: 500 });
  }
}
