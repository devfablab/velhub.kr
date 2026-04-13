import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';

type RouteContext = {
  params: Promise<{
    boardName: string;
  }>;
};

type RequestBody = {
  siteName: string | null;
  sortOrder: number | string | null;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function normalizeSortOrder(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      return NaN;
    }

    return Number(normalizedValue);
  }

  return NaN;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { boardName } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const sortOrder = normalizeSortOrder(requestBody.sortOrder);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!Number.isFinite(sortOrder)) {
      return Response.json({ error: 'sort_order가 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (session.status === 'FAIL') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    const updateBoardOrder = await supabaseAdmin
      .from('boards')
      .update({
        sort_order: sortOrder,
      })
      .eq('id', board.data.id);

    if (updateBoardOrder.error) {
      return Response.json({ error: '게시판 정렬 저장에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시판 정렬 저장에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시판 정렬 저장에 실패했습니다.' }, { status: 500 });
  }
}
