import { getSessionClaims } from '@/lib/session';
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
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

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

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error || !stigmaResult.data) {
      return Response.json({ error: '사용자 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const rhizomeResult = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (rhizomeResult.error || !rhizomeResult.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const manageResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('role')
      .eq('site_id', rhizomeResult.data.id)
      .eq('user_id', stigmaResult.data.id)
      .in('role', ['owner', 'manager'])
      .maybeSingle();

    if (manageResult.error || !manageResult.data) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const duplicateResult = await supabaseAdmin
      .from('boards')
      .select('id')
      .eq('site_id', rhizomeResult.data.id)
      .eq('board_key', boardKey)
      .maybeSingle();

    if (duplicateResult.error) {
      return Response.json({ error: '게시판 중복 확인에 실패했습니다.' }, { status: 500 });
    }

    if (duplicateResult.data) {
      return Response.json({ error: '이미 존재하는 게시판 식별자입니다.' }, { status: 400 });
    }

    const sortOrderResult = await supabaseAdmin
      .from('boards')
      .select('sort_order')
      .eq('site_id', rhizomeResult.data.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sortOrderResult.error) {
      return Response.json({ error: '게시판 정렬값 확인에 실패했습니다.' }, { status: 500 });
    }

    const nextSortOrder =
      typeof sortOrderResult.data?.sort_order === 'number' ? sortOrderResult.data.sort_order + 1 : 1;

    const insertResult = await supabaseAdmin
      .from('boards')
      .insert({
        board_key: boardKey,
        board_label: boardLabel,
        board_type: boardType,
        is_active: isActive,
        sort_order: nextSortOrder,
        markdown_status: markdownStatus,
        site_id: rhizomeResult.data.id,
      })
      .select('id, board_key')
      .maybeSingle();

    if (insertResult.error || !insertResult.data) {
      return Response.json({ error: '게시판 생성에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      boardId: insertResult.data.id,
      boardName: insertResult.data.board_key,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '게시판 생성에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '게시판 생성에 실패했습니다.' }, { status: 500 });
  }
}
