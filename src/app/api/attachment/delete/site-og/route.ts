import { getSiteOgAccess, SITE_OG_BUCKET } from '@/lib/service/siteOgImage';
import { normalizeText } from '@/lib/utils';

type RequestBody = {
  siteName?: string | null;
  path?: string | null;
};

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const storagePath = normalizeText(requestBody.path);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getSiteOgAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    if (!storagePath || !storagePath.startsWith(`${access.siteId}/`)) {
      return Response.json({ error: '삭제할 이미지 경로가 올바르지 않습니다.' }, { status: 400 });
    }

    const deleteResult = await access.supabaseAdmin.storage.from(SITE_OG_BUCKET).remove([storagePath]);

    if (deleteResult.error) {
      return Response.json({ error: '오픈그래프 이미지 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '오픈그래프 이미지 삭제에 실패했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '오픈그래프 이미지 삭제에 실패했습니다.' }, { status: 500 });
  }
}
