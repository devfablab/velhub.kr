import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RequestBody = {
  siteName: string | null;
  subject: string | null;
  summary: string | null;
  contentHtml: string | null;
  contentMarkdown: string | null;
  thumbnailImage: string | null;
  thumbnailWidth: number | string | null;
  thumbnailHeight: number | string | null;
};

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

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const subject = normalizeText(requestBody.subject);
    const summary = normalizeText(requestBody.summary);
    const contentHtml = requestBody.contentHtml ?? '';
    const contentMarkdown = requestBody.contentMarkdown ?? '';
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

    const rhizome = await supabaseAdmin.from('rhizomes').select('id, site_type').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (rhizome.data.site_type !== 'blog') {
      return Response.json({ error: '블로그 사이트만 접근할 수 있습니다.' }, { status: 403 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (session.case === 'guest-site' || session.case === 'guest-public') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (!session.authUserId) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const post = await supabaseAdmin.rpc('create_post_with_blog_board', {
      p_site_id: rhizome.data.id,
      p_user_id: session.authUserId,
      p_subject: subject,
      p_summary: summary || null,
      p_content_html: contentHtml,
      p_content_markdown: contentMarkdown || null,
      p_edited_at: new Date().toISOString(),
      p_thumbnail_image: thumbnailImage || null,
      p_thumbnail_width: thumbnailWidth,
      p_thumbnail_height: thumbnailHeight,
    });

    if (post.error || !Array.isArray(post.data) || !post.data[0]) {
      return Response.json({ error: post.error?.message || '블로그 글 출간에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      boardId: post.data[0].board_id,
      postId: post.data[0].post_id,
      createdBoard: post.data[0].created_board,
      slug: String(post.data[0].slug),
      idx: post.data[0].idx,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '블로그 글 출간에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '블로그 글 출간에 실패했습니다.' }, { status: 500 });
  }
}
