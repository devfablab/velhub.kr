import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RequestBody = {
  path?: string | null;
};

const COMMUNITY_ANSWER_BUCKET = 'community_answer';

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestBody = (await request.json()) as RequestBody;
    const filePath = normalizeText(requestBody.path);

    if (!filePath) {
      return Response.json({ error: '삭제할 파일 경로가 없습니다.' }, { status: 400 });
    }

    const userPrefix = `${sessionClaims.userId}/`;

    if (!filePath.startsWith(userPrefix)) {
      return Response.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const removeResult = await supabaseAdmin.storage.from(COMMUNITY_ANSWER_BUCKET).remove([filePath]);

    if (removeResult.error) {
      return Response.json({ error: removeResult.error.message || '이미지 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '이미지 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '이미지 삭제에 실패했습니다.' }, { status: 500 });
  }
}
