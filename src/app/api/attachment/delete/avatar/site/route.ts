import { getSiteOgAccess } from '@/lib/service/siteOgImage';
import { getSessionClaims } from '@/lib/session';
import { normalizeText } from '@/lib/utils';

type RequestBody = {
  path?: string;
  siteName?: string;
};

const AVATAR_BUCKET = 'avatar';

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json().catch(() => null)) as RequestBody | null;
    const targetPath = normalizeText(requestBody?.path);
    const siteName = normalizeText(requestBody?.siteName).toLowerCase();

    if (!targetPath || !siteName) {
      return Response.json({ error: '삭제할 파일 경로가 없습니다.' }, { status: 400 });
    }

    const access = await getSiteOgAccess(siteName);
    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const sessionClaims = await getSessionClaims();
    const isCurrentSitePath = targetPath.startsWith(`site/${access.siteId}/`);
    const isLegacyOwnerPath = Boolean(sessionClaims?.userId && targetPath.startsWith(`site/${sessionClaims.userId}/`));

    if (!isCurrentSitePath && !isLegacyOwnerPath) {
      return Response.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
    }

    const removeResult = await access.supabaseAdmin.storage.from(AVATAR_BUCKET).remove([targetPath]);

    if (removeResult.error) {
      return Response.json({ error: '사이트 아바타 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '사이트 아바타 삭제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '사이트 아바타 삭제에 실패했습니다.' }, { status: 500 });
  }
}
