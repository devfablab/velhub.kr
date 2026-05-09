import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RequestBody = {
  siteName: string | null;
  boardLabel: string | null;
};

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const boardLabel = normalizeText(requestBody.boardLabel);

    if (!siteName) {
      return Response.json({ ok: false, error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!boardLabel) {
      return Response.json(
        {
          ok: false,
          boardLabel: '',
          error: '게시판 이름을 입력해주세요.',
        },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ ok: false, error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (session.case !== 'staff') {
      return Response.json({ ok: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const duplicateBoardLabel = await supabaseAdmin
      .from('boards')
      .select('id')
      .eq('site_id', rhizome.data.id)
      .eq('board_label', boardLabel)
      .maybeSingle();

    if (duplicateBoardLabel.error) {
      return Response.json({ ok: false, error: '게시판 이름 확인에 실패했습니다.' }, { status: 500 });
    }

    if (duplicateBoardLabel.data) {
      return Response.json(
        {
          ok: false,
          boardLabel,
          error: '이미 사용 중인 게시판 이름입니다.',
        },
        { status: 400 },
      );
    }

    return Response.json({
      ok: true,
      boardLabel,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { ok: false, error: unknownError.message || '게시판 이름 확인에 실패했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ ok: false, error: '게시판 이름 확인에 실패했습니다.' }, { status: 500 });
  }
}
