import { getSiteOgAccess } from '@/lib/service/siteOgImage';
import { normalizeText } from '@/lib/utils';

type RequestBody = { siteName?: unknown; path?: unknown };

const SITE_LOGO_BUCKET = 'site-logo';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as RequestBody | null;
    const siteName = normalizeText(typeof body?.siteName === 'string' ? body.siteName : '').toLowerCase();
    const path = normalizeText(typeof body?.path === 'string' ? body.path : '');

    if (!siteName || !path) {
      return Response.json({ error: '삭제할 로고 정보를 확인할 수 없습니다.' }, { status: 400 });
    }

    const access = await getSiteOgAccess(siteName);
    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    if (!path.startsWith(`${access.siteId}/`)) {
      return Response.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
    }

    const removeResult = await access.supabaseAdmin.storage.from(SITE_LOGO_BUCKET).remove([path]);
    if (removeResult.error) {
      return Response.json({ error: '사이트 로고 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (unknownError) {
    return Response.json({ error: unknownError instanceof Error ? unknownError.message || '사이트 로고 삭제에 실패했습니다.' : '사이트 로고 삭제에 실패했습니다.' }, { status: 500 });
  }
}
