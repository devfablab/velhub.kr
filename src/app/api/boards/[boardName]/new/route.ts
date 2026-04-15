import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type RouteContext = {
  params: Promise<{
    boardName: string;
  }>;
};

type RequestBody = {
  subject: string | null;
  summary: string | null;
  contentHtml: string | null;
  contentMarkdown: string | null;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { boardName } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as RequestBody;

    const subject = normalizeText(requestBody.subject);
    const summary = normalizeText(requestBody.summary);
    const contentHtml = requestBody.contentHtml ?? '';
    const contentMarkdown = requestBody.contentMarkdown ?? '';

    if (!subject) {
      return Response.json({ error: '제목을 입력해주세요.' }, { status: 400 });
    }

    if (!contentHtml.trim()) {
      return Response.json({ error: '내용을 입력해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

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
      return Response.json({ error: '페이지는 이 경로에서 작성할 수 없습니다.' }, { status: 400 });
    }

    const lastPost = await supabaseAdmin
      .from('posts')
      .select('idx')
      .eq('board_id', board.data.id)
      .order('idx', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastPost.error) {
      return Response.json({ error: '글 작성에 실패했습니다.' }, { status: 500 });
    }

    const nextIdx = typeof lastPost.data?.idx === 'number' ? Number(lastPost.data.idx) + 1 : 1;

    let slug = 0;

    for (;;) {
      slug = Math.floor(Math.random() * 10000000000);

      const duplicatePost = await supabaseAdmin
        .from('posts')
        .select('id')
        .eq('board_id', board.data.id)
        .eq('slug', slug)
        .maybeSingle();

      if (duplicatePost.error) {
        return Response.json({ error: '글 작성에 실패했습니다.' }, { status: 500 });
      }

      if (!duplicatePost.data) {
        break;
      }
    }

    const insertPost = await supabaseAdmin
      .from('posts')
      .insert({
        user_id: sessionClaims.userId,
        slug,
        content_html: contentHtml,
        content_markdown: contentMarkdown.trim() ? contentMarkdown : null,
        subject,
        summary: summary || null,
        edited_at: new Date().toISOString(),
        idx: nextIdx,
        board_id: board.data.id,
        site_id: rhizome.data.id,
        is_closed: false,
      })
      .select('id, slug')
      .maybeSingle();

    if (insertPost.error || !insertPost.data) {
      return Response.json({ error: '글 작성에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      contentId: insertPost.data.id,
      slug: String(insertPost.data.slug),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '글 작성에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '글 작성에 실패했습니다.' }, { status: 500 });
  }
}
