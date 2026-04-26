import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RequestBody = {
  siteName?: string | null;
  path?: string | null;
};

const POST_BUCKET = 'post';

function isAllowedPostPath(value: string) {
  return value.startsWith('thumbnail/') || value.startsWith('images/') || value.startsWith('editor/');
}

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const path = normalizeText(requestBody.path);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!path) {
      return Response.json({ error: 'path가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!isAllowedPostPath(path)) {
      return Response.json({ error: '삭제할 수 없는 경로입니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (!session.authUserId || (session.case !== 'staff' && session.case !== 'member')) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const deleteResult = await supabaseAdmin.storage.from(POST_BUCKET).remove([path]);

    if (deleteResult.error) {
      return Response.json({ error: '이미지 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '이미지 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '이미지 삭제에 실패했습니다.' }, { status: 500 });
  }
}
