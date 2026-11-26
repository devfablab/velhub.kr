import {
  checkFCaptchaAvailability,
  createCaptchaPassToken,
  isCaptchaPurpose,
  isFCaptchaUnavailable,
  isLoginCaptchaPurpose,
  verifyFCaptchaToken,
  verifyTurnstileToken,
} from '@/lib/captcha.server';
import { getClientIpAddress } from '@/lib/clientRequest';
import { getSessionClaims } from '@/lib/session/server';

type RequestBody = {
  action?: unknown;
  provider?: unknown;
  token?: unknown;
  purpose?: unknown;
};

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };
const FAILED_MESSAGE = '보안 확인에 실패했습니다. 다시 시도해 주세요.';

function getRequestHostname(request: Request) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';

  return host.split(':')[0].toLowerCase();
}

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json().catch(() => null)) as RequestBody | null;
    const purpose = requestBody?.purpose;

    if (!isCaptchaPurpose(purpose)) {
      return Response.json({ error: '보안 확인 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    if (requestBody?.action === 'fallback') {
      const isAvailable = await checkFCaptchaAvailability();

      return Response.json(
        isAvailable ? { error: '보안 확인을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.' } : { fallback: true },
        { status: isAvailable ? 503 : 200, headers: NO_STORE_HEADERS },
      );
    }

    const token = typeof requestBody?.token === 'string' ? requestBody.token : '';

    if (!token) {
      return Response.json({ error: '보안 확인 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    const clientIpAddress = getClientIpAddress(request.headers);
    let subject = clientIpAddress ?? '';

    if (isLoginCaptchaPurpose(purpose)) {
      const sessionClaims = await getSessionClaims();

      if (!sessionClaims) {
        return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
      }

      subject = sessionClaims.userId;
    }

    if (requestBody?.provider === 'turnstile') {
      if (!(await isFCaptchaUnavailable()) || !(await verifyTurnstileToken(token, clientIpAddress))) {
        return Response.json({ error: FAILED_MESSAGE }, { status: 400 });
      }

      return Response.json({ passToken: createCaptchaPassToken(purpose, subject) }, { headers: NO_STORE_HEADERS });
    }

    const result = await verifyFCaptchaToken(token, clientIpAddress, getRequestHostname(request));

    if (result === 'unavailable') {
      return Response.json({ fallback: true }, { headers: NO_STORE_HEADERS });
    }

    if (result === 'rejected') {
      return Response.json({ error: FAILED_MESSAGE }, { status: 400 });
    }

    return Response.json({ passToken: createCaptchaPassToken(purpose, subject) }, { headers: NO_STORE_HEADERS });
  } catch {
    return Response.json({ error: '보안 확인을 처리하지 못했습니다.' }, { status: 500 });
  }
}
