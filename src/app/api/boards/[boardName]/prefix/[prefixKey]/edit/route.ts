import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
    prefixKey: string;
  }>;
};

type RequestBody = {
  siteName: string | null;
  prefixLabel: string | null;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { boardName, prefixKey } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const normalizedPrefixKey = Number(prefixKey);

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!Number.isFinite(normalizedPrefixKey) || normalizedPrefixKey < 1) {
      return Response.json({ error: 'prefixKey가 유효하지 않습니다.' }, { status: 400 });
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

    if (session.status === 'FAIL' || session.case !== 'staff') {
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

    const currentPrefix = await supabaseAdmin
      .from('board_prefixes')
      .select('id, prefix_key, prefix_label')
      .eq('site_id', rhizome.data.id)
      .eq('board_id', board.data.id)
      .eq('prefix_key', normalizedPrefixKey)
      .maybeSingle();

    if (currentPrefix.error || !currentPrefix.data) {
      return Response.json({ error: '말머리를 찾을 수 없습니다.' }, { status: 404 });
    }

    const duplicatePrefix = await supabaseAdmin
      .from('board_prefixes')
      .select('id')
      .eq('site_id', rhizome.data.id)
      .eq('board_id', board.data.id)
      .eq('prefix_label', prefixLabel)
      .neq('id', currentPrefix.data.id)
      .maybeSingle();

    if (duplicatePrefix.error) {
      return Response.json({ error: '말머리 확인에 실패했습니다.' }, { status: 500 });
    }

    if (duplicatePrefix.data) {
      return Response.json({ error: '이미 존재하는 말머리입니다.' }, { status: 400 });
    }

    const updatePrefix = await supabaseAdmin
      .from('board_prefixes')
      .update({
        prefix_label: prefixLabel,
      })
      .eq('id', currentPrefix.data.id)
      .select('id, created_at, prefix_key, prefix_label, board_id, site_id')
      .maybeSingle();

    if (updatePrefix.error || !updatePrefix.data) {
      return Response.json({ error: '말머리 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      prefix: updatePrefix.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '말머리 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '말머리 수정에 실패했습니다.' }, { status: 500 });
  }
}
