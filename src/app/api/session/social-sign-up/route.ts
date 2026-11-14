import { getSessionClaims } from '@/lib/session/server';
import { getNeedsSocialSignUp } from '@/lib/session/siteMember.server';

export async function GET() {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims?.userId) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  try {
    const needsSocialSignUp = await getNeedsSocialSignUp(sessionClaims.userId);

    return Response.json({ ok: true, needsSocialSignUp });
  } catch {
    return Response.json({ error: '회원가입 상태를 확인하지 못했습니다.' }, { status: 500 });
  }
}
