import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
  }>;
};

type RequestBody = {
  siteName: string | null;
  prefixLabel: string | null;
};

function createRandomPrefixKey() {
  return Math.floor(Math.random() * 900) + 100;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { boardName } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const prefixLabel = normalizeText(requestBody.prefixLabel);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!prefixLabel) {
      return Response.json({ error: '말머리명을 입력해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id, site_type').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id, post_type')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (rhizome.data.site_type !== 'community') {
      return Response.json({ error: '커뮤니티에서만 말머리를 사용할 수 있습니다.' }, { status: 403 });
    }

    if (board.data.post_type !== 'prefix') {
      return Response.json({ error: '말머리형 게시판이 아닙니다.' }, { status: 403 });
    }

    const duplicatePrefix = await supabaseAdmin
      .from('board_prefixes')
      .select('id')
      .eq('site_id', rhizome.data.id)
      .eq('board_id', board.data.id)
      .eq('prefix_label', prefixLabel)
      .maybeSingle();

    if (duplicatePrefix.error) {
      return Response.json({ error: '말머리 확인에 실패했습니다.' }, { status: 500 });
    }

    if (duplicatePrefix.data) {
      return Response.json({ error: '이미 존재하는 말머리입니다.' }, { status: 400 });
    }

    let nextPrefixKey: number | null = null;

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const candidate = createRandomPrefixKey();

      const duplicateKey = await supabaseAdmin
        .from('board_prefixes')
        .select('id')
        .eq('site_id', rhizome.data.id)
        .eq('board_id', board.data.id)
        .eq('prefix_key', candidate)
        .maybeSingle();

      if (duplicateKey.error) {
        return Response.json({ error: '말머리 생성에 실패했습니다.' }, { status: 500 });
      }

      if (!duplicateKey.data) {
        nextPrefixKey = candidate;
        break;
      }
    }

    if (nextPrefixKey === null) {
      return Response.json({ error: '말머리 식별자 생성에 실패했습니다.' }, { status: 500 });
    }

    const insertPrefix = await supabaseAdmin
      .from('board_prefixes')
      .insert({
        prefix_key: nextPrefixKey,
        prefix_label: prefixLabel,
        board_id: board.data.id,
        site_id: rhizome.data.id,
      })
      .select('id, created_at, prefix_key, prefix_label, board_id, site_id')
      .maybeSingle();

    if (insertPrefix.error || !insertPrefix.data) {
      return Response.json({ error: '말머리 생성에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      prefix: insertPrefix.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '말머리 생성에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '말머리 생성에 실패했습니다.' }, { status: 500 });
  }
}
