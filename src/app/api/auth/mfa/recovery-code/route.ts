import { issueTotpRecoveryCode } from '@/lib/auth/totpRecovery.server';
import { getSessionClaims } from '@/lib/session';

export async function POST() {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims?.userId) {
      return Response.json(
        { title: '로그인 정보 확인', errors: ['로그인 정보가 만료되었습니다. 다시 로그인해 주세요.'] },
        { status: 401 },
      );
    }

    if (sessionClaims.authenticationLevel !== 'aal2') {
      return Response.json(
        { title: '2단계 인증 확인', errors: ['2단계 인증을 완료한 뒤 복구 코드를 발급할 수 있습니다.'] },
        { status: 403 },
      );
    }

    await issueTotpRecoveryCode(sessionClaims.userId);
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[totp-recovery-code] issue error', error);
    return Response.json(
      { title: '복구 코드 발급', errors: ['복구 코드를 발급하지 못했습니다. 잠시 후 다시 시도해 주세요.'] },
      { status: 500 },
    );
  }
}
