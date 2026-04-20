import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type RequestBody = {
  path: string | null;
};

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestBody = (await request.json()) as RequestBody;
    const path = requestBody.path?.trim() ?? '';

    if (!path) {
      return Response.json({ error: '삭제할 경로가 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const deleteResult = await supabaseAdmin.storage.from('series').remove([path]);

    if (deleteResult.error) {
      return Response.json({ error: '시리즈 이미지 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
    });
  } catch {
    return Response.json({ error: '시리즈 이미지 삭제에 실패했습니다.' }, { status: 500 });
  }
}
