import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { getWordingProfilerViolationFields } from '@/lib/wordingProfiler/server';

type RouteContext = {
  params: Promise<{
    boardName: string;
  }>;
};

type RequestBody = {
  siteName?: unknown;
  poll?: {
    question?: unknown;
    options?: Array<{ label?: unknown }>;
  };
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { boardName } = await params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const body = (await request.json()) as RequestBody;
    const siteName = normalizeText(body.siteName).toLowerCase();

    if (!siteName || !normalizedBoardName) {
      return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const rhizomeResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_type')
      .eq('site_key', siteName)
      .maybeSingle();

    if (rhizomeResult.error || !rhizomeResult.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({ siteId: rhizomeResult.data.id });
    if (!['admin', 'staff', 'member'].includes(session.case)) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const boardResult = await supabaseAdmin
      .from('boards')
      .select('id')
      .eq('site_id', rhizomeResult.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (boardResult.error || !boardResult.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (rhizomeResult.data.site_type !== 'community') {
      return Response.json({ fields: [] });
    }

    const options = Array.isArray(body.poll?.options) ? body.poll.options : [];
    const fields = await getWordingProfilerViolationFields(rhizomeResult.data.id, {
      pollQuestion: normalizeText(body.poll?.question),
      ...Object.fromEntries(
        options.map((option, index) => [`pollOption${index}`, normalizeText(option?.label)]),
      ),
    });

    return Response.json({ fields });
  } catch (error) {
    console.error('투표 워딩 프로파일러 검사 실패:', error);
    return Response.json({ error: '워딩 프로파일러를 확인하지 못했습니다.' }, { status: 500 });
  }
}
