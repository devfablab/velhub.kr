import { loadGuidelineAppealItems } from '@/lib/reports/guidelineAppealServer';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';

function getRequestOrigin(request: Request, requestUrl: URL) {
  const forwardedProtocol = normalizeText(request.headers.get('x-forwarded-proto')).split(',')[0]?.trim();
  const forwardedHost = normalizeText(request.headers.get('x-forwarded-host')).split(',')[0]?.trim();
  const host = forwardedHost || normalizeText(request.headers.get('host'));

  if (!host) {
    return requestUrl.origin;
  }

  const protocol = forwardedProtocol || requestUrl.protocol.replace(':', '');
  return `${protocol}://${host}`;
}

export async function GET(request: Request) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestUrl = new URL(request.url);
    const items = await loadGuidelineAppealItems({
      authUserId: session.authUserId,
      origin: getRequestOrigin(request, requestUrl),
    });

    return Response.json({ items });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '가이드라인 소명 내역을 불러오지 못했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '가이드라인 소명 내역을 불러오지 못했습니다.' }, { status: 500 });
  }
}
