import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

function normalizeBoardKey(rawValue: string | null | undefined) {
  return (rawValue ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
}

function hasInvalidBoardKeyCharacters(value: string) {
  return /[^a-z0-9-]/.test(value);
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const boardKey = normalizeBoardKey(requestUrl.searchParams.get('boardKey'));

    if (!siteName) {
      return Response.json({ ok: false, error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!boardKey) {
      return Response.json({ ok: false, error: '게시판 식별자를 입력해주세요.' }, { status: 400 });
    }

    if (hasInvalidBoardKeyCharacters(boardKey)) {
      return Response.json({ ok: false, error: "영소문자, 하이픈('-'), 숫자만 사용 가능합니다." }, { status: 400 });
    }

    if (/^\d/.test(boardKey)) {
      return Response.json({ ok: false, error: '게시판 식별자는 숫자로 시작할 수 없습니다.' }, { status: 400 });
    }

    if (boardKey.length < 5 || boardKey.length > 15) {
      return Response.json({ ok: false, error: '게시판 식별자는 5자 이상 15자 이하여야 합니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ ok: false, error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const denylist = await supabaseAdmin.from('denylist_other').select('word').eq('word', boardKey).maybeSingle();

    if (denylist.error) {
      return Response.json({ ok: false, error: '게시판 식별자 확인에 실패했습니다.' }, { status: 500 });
    }

    if (denylist.data) {
      return Response.json({ ok: false, error: '사용할 수 없는 게시판 식별자입니다.' }, { status: 400 });
    }

    const duplicateBoard = await supabaseAdmin
      .from('boards')
      .select('id')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', boardKey)
      .maybeSingle();

    if (duplicateBoard.error) {
      return Response.json({ ok: false, error: '게시판 식별자 확인에 실패했습니다.' }, { status: 500 });
    }

    if (duplicateBoard.data) {
      return Response.json({ ok: false, error: '사용할 수 없는 게시판 식별자입니다.' }, { status: 400 });
    }

    return Response.json({
      ok: true,
      boardKey,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { ok: false, error: unknownError.message || '게시판 식별자 확인에 실패했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ ok: false, error: '게시판 식별자 확인에 실패했습니다.' }, { status: 500 });
  }
}
