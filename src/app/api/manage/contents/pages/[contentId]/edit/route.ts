import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{ contentId: string }>;
};

type RequestBody = {
  siteName?: string | null;
  slug?: string | null;
  subject?: string | null;
  summary?: string | null;
  contentHtml?: string | null;
  contentMarkdown?: string | null;
  ogImage?: string | null;
  attachmentSlug?: string | null;
  attachmentOrigin?: string | null;
  isComment?: boolean;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { contentId } = await context.params;
    const requestBody = (await request.json()) as RequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const currentSlug = normalizeText(contentId);
    const slug = normalizeText(requestBody.slug).toLowerCase();
    const subject = normalizeText(requestBody.subject);

    if (!siteName || !currentSlug || !slug || !subject) {
      return Response.json({ error: '페이지 수정에 필요한 정보를 확인해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const rhizomeResult = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (rhizomeResult.error || !rhizomeResult.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({ siteId: rhizomeResult.data.id });
    if (!session.authUserId || !session.stigmaId || (session.case !== 'admin' && session.case !== 'staff')) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const pageBoardResult = await supabaseAdmin
      .from('boards')
      .select('id')
      .eq('site_id', rhizomeResult.data.id)
      .eq('board_type', 'page')
      .maybeSingle();

    if (pageBoardResult.error || !pageBoardResult.data) {
      return Response.json({ error: '페이지 게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    const pageResult = await supabaseAdmin
      .from('pages')
      .select('id')
      .eq('site_id', rhizomeResult.data.id)
      .eq('board_id', pageBoardResult.data.id)
      .eq('slug', currentSlug)
      .maybeSingle();

    if (pageResult.error || !pageResult.data) {
      return Response.json({ error: '페이지를 찾을 수 없습니다.' }, { status: 404 });
    }

    const updatedAt = new Date().toISOString();
    const updateResult = await supabaseAdmin
      .from('pages')
      .update({
        slug,
        subject,
        summary: normalizeText(requestBody.summary) || null,
        content_html: requestBody.contentHtml ?? '',
        content_markdown: requestBody.contentMarkdown ?? null,
        og_image: normalizeText(requestBody.ogImage) || null,
        attachment_slug: normalizeText(requestBody.attachmentSlug) || null,
        attachment_origin: normalizeText(requestBody.attachmentOrigin) || null,
        is_comment: requestBody.isComment === true,
        edited_at: updatedAt,
      })
      .eq('id', pageResult.data.id)
      .select('slug')
      .single();

    if (updateResult.error || !updateResult.data) {
      return Response.json({ error: '페이지 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ ok: true, slug: updateResult.data.slug });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message || '페이지 수정에 실패했습니다.' : '페이지 수정에 실패했습니다.',
      },
      { status: 500 },
    );
  }
}
