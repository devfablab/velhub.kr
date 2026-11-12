import { getSessionClaims } from '@/lib/session/server';
import {
  checkSiteCaptchaAnswer,
  createSiteCaptchaChallenge,
  refreshSiteCaptchaChallenge,
} from '@/lib/site/siteCaptcha.server';

type RequestBody = {
  action?: unknown;
  challengeToken?: unknown;
  answer?: unknown;
};

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function GET() {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    return Response.json(createSiteCaptchaChallenge(sessionClaims.userId), { headers: NO_STORE_HEADERS });
  } catch {
    return Response.json({ error: '보안 문자를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestBody = (await request.json().catch(() => null)) as RequestBody | null;
    const challengeToken = typeof requestBody?.challengeToken === 'string' ? requestBody.challengeToken : '';
    const answer = typeof requestBody?.answer === 'string' ? requestBody.answer : '';

    if (requestBody?.action === 'refresh') {
      const challenge = refreshSiteCaptchaChallenge(sessionClaims.userId, challengeToken);

      return Response.json(challenge ? { status: 'refreshed', challenge } : { status: 'blocked' }, {
        headers: NO_STORE_HEADERS,
      });
    }

    if (!challengeToken || !answer.trim()) {
      return Response.json({ error: '보안 문자를 입력해 주세요.' }, { status: 400 });
    }

    return Response.json(checkSiteCaptchaAnswer(sessionClaims.userId, challengeToken, answer), {
      headers: NO_STORE_HEADERS,
    });
  } catch {
    return Response.json({ error: '보안 문자를 확인하지 못했습니다.' }, { status: 500 });
  }
}
