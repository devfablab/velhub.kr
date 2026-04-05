import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type RequestBody = {
  path: string;
};

const AVATAR_BUCKET = 'avatar';

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestBody = (await request.json()) as RequestBody;
    const targetPath = requestBody.path?.trim() ?? '';

    if (!targetPath) {
      return Response.json({ error: '삭제할 파일 경로가 없습니다.' }, { status: 400 });
    }

    if (!targetPath.startsWith(`${sessionClaims.userId}/`)) {
      return Response.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const removeResult = await supabaseAdmin.storage.from(AVATAR_BUCKET).remove([targetPath]);

    if (removeResult.error) {
      return Response.json({ error: '아바타 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '아바타 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '아바타 삭제에 실패했습니다.' }, { status: 500 });
  }
}
