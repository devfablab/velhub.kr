import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';

type RequestBody = {
  siteName: string | null;
  boardKey: string | null;
  boardLabel: string | null;
  boardType: string | null;
  isActive: boolean | null;
  markdownStatus: string | null;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function normalizeKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeKey(requestBody.siteName);
    const boardKey = normalizeKey(requestBody.boardKey);
    const boardLabel = normalizeText(requestBody.boardLabel);
    const boardType = normalizeKey(requestBody.boardType);
    const isActive = requestBody.isActive;
    const markdownStatus = normalizeKey(requestBody.markdownStatus);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!boardKey) {
      return Response.json({ error: '게시판 식별자를 입력해주세요.' }, { status: 400 });
    }

    if (!boardLabel) {
      return Response.json({ error: '게시판 이름을 입력해주세요.' }, { status: 400 });
    }

    if (!boardType) {
      return Response.json({ error: '게시판 종류를 입력해주세요.' }, { status: 400 });
    }

    if (typeof isActive !== 'boolean') {
      return Response.json({ error: '활성화 상태를 확인해주세요.' }, { status: 400 });
    }

    if (!markdownStatus) {
      return Response.json({ error: '마크다운 상태를 입력해주세요.' }, { status: 400 });
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

    const duplicateBoardKey = await supabaseAdmin
      .from('boards')
      .select('id')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', boardKey)
      .maybeSingle();

    if (duplicateBoardKey.error) {
      return Response.json({ error: '게시판 중복 확인에 실패했습니다.' }, { status: 500 });
    }

    if (duplicateBoardKey.data) {
      return Response.json({ error: '이미 존재하는 게시판 식별자입니다.' }, { status: 400 });
    }

    const sortOrder = await supabaseAdmin
      .from('boards')
      .select('sort_order')
      .eq('site_id', rhizome.data.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sortOrder.error) {
      return Response.json({ error: '게시판 정렬값 확인에 실패했습니다.' }, { status: 500 });
    }

    const nextSortOrder = typeof sortOrder.data?.sort_order === 'number' ? sortOrder.data.sort_order + 1 : 1;

    const insertBoard = await supabaseAdmin
      .from('boards')
      .insert({
        board_key: boardKey,
        board_label: boardLabel,
        board_type: boardType,
        is_active: isActive,
        sort_order: nextSortOrder,
        markdown_status: markdownStatus,
        site_id: rhizome.data.id,
      })
      .select('id, board_key')
      .maybeSingle();

    if (insertBoard.error || !insertBoard.data) {
      return Response.json({ error: '게시판 개설에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      boardId: insertBoard.data.id,
      boardName: insertBoard.data.board_key,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시판 개설에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시판 개설에 실패했습니다.' }, { status: 500 });
  }
}
