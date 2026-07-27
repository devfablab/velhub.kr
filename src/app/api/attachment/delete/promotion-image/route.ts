import { getSitePromotionAccess, SITE_PROMOTION_BUCKET } from '@/lib/service/sitePromotionImage';
import { normalizeText } from '@/lib/utils';

type RequestBody = { siteName?: string | null; path?: string | null };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const siteName = normalizeText(body.siteName).toLowerCase();
    const path = normalizeText(body.path);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getSitePromotionAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    if (!path || !path.startsWith(`${access.siteId}/`)) {
      return Response.json({ error: '삭제할 이미지 경로가 올바르지 않습니다.' }, { status: 400 });
    }

    const result = await access.supabaseAdmin.storage.from(SITE_PROMOTION_BUCKET).remove([path]);

    if (result.error) {
      return Response.json({ error: '프로모션 이미지 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (unknownError) {
    return Response.json(
      { error: unknownError instanceof Error ? unknownError.message || '프로모션 이미지 삭제에 실패했습니다.' : '프로모션 이미지 삭제에 실패했습니다.' },
      { status: 500 },
    );
  }
}
