import { canManageCommunityPages, getCommunityManagerAccess } from '@/lib/community/community-manager/utils';
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

function getEditorImagePaths(...contents: Array<string | null | undefined>) {
  const paths = new Set<string>();

  for (const content of contents) {
    if (!content) continue;

    for (const match of content.matchAll(/\/storage\/v1\/object\/public\/post\/([^"'<>?\s)]+)/g)) {
      paths.add(decodeURIComponent(match[1]));
    }
  }

  return paths;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { contentId } = await context.params;
    const requestBody = (await request.json()) as RequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const currentSlug = normalizeText(contentId);
    const slug = normalizeText(requestBody.slug).toLowerCase();
    const subject = normalizeText(requestBody.subject);
    const contentHtml = requestBody.contentHtml ?? '';
    const contentMarkdown = requestBody.contentMarkdown ?? '';

    if (!siteName || !currentSlug || !slug || !subject) {
      return Response.json({ error: '페이지 수정에 필요한 정보를 확인해주세요.' }, { status: 400 });
    }

    if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
      return Response.json({ error: "페이지 식별자는 영소문자로 시작하고 영소문자, 숫자, 하이픈(-)만 사용할 수 있습니다." }, { status: 400 });
    }

    if (!contentHtml.trim()) {
      return Response.json({ error: '페이지 내용을 입력해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const rhizomeResult = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (rhizomeResult.error || !rhizomeResult.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({ siteId: rhizomeResult.data.id });
    let canManagePages = session.case === 'admin' || session.case === 'staff';

    if (!canManagePages) {
      try {
        const access = await getCommunityManagerAccess(siteName, { requireManagerControlPermission: false });
        canManagePages = canManageCommunityPages(access.actor);
      } catch {
        canManagePages = false;
      }
    }

    if (!session.authUserId || !session.stigmaId || !canManagePages) {
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
      .select('id, content_html, content_markdown, og_image')
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
        content_html: contentHtml,
        content_markdown: contentMarkdown || null,
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

    const previousEditorPaths = getEditorImagePaths(pageResult.data.content_html, pageResult.data.content_markdown);
    const nextEditorPaths = getEditorImagePaths(contentHtml, contentMarkdown);
    const removedEditorPaths = [...previousEditorPaths].filter((path) => !nextEditorPaths.has(path));

    if (removedEditorPaths.length > 0) {
      const removalResult = await supabaseAdmin.storage.from('post').remove(removedEditorPaths);
      if (removalResult.error) console.error('페이지 본문 이미지 삭제에 실패했습니다.', removalResult.error);
    }

    const nextOgImage = normalizeText(requestBody.ogImage);
    if (pageResult.data.og_image && pageResult.data.og_image !== nextOgImage) {
      const removalResult = await supabaseAdmin.storage.from('og-image').remove([pageResult.data.og_image]);
      if (removalResult.error) console.error('페이지 오픈그래프 이미지 삭제에 실패했습니다.', removalResult.error);
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
