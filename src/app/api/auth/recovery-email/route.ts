import { SETTINGS_CHECK_REQUIRED_CODE } from '@/lib/auth/accessContext';
import {
  normalizeRecoveryEmail,
  normalizeRecoveryEmailCode,
  RECOVERY_EMAIL_CODE_LENGTH,
  RECOVERY_EMAIL_LABEL,
} from '@/lib/auth/recoveryEmail';
import {
  getRecoveryEmailState,
  saveRecoveryEmail,
  sendRecoveryEmailCode,
  verifyRecoveryEmailCode,
} from '@/lib/auth/recoveryEmail.server';
import { getReadSecurityState } from '@/lib/auth/securityCheck.server';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { getSessionClaims } from '@/lib/session/server';
import { maskEmail } from '@/lib/utils';

type RecoveryEmailRequestBody = {
  action?: unknown;
  email?: unknown;
  code?: unknown;
};

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

async function hasCompletedSignUp(userId: string) {
  const stigmaResult = await getSupabaseAdmin()
    .from('stigmas')
    .select('is_agree_term, is_agree_child, is_agree_privacy')
    .eq('user_id', userId)
    .maybeSingle();

  if (stigmaResult.error) {
    throw new Error('회원 정보를 확인하지 못했습니다.');
  }

  return Boolean(
    stigmaResult.data?.is_agree_term === true &&
    stigmaResult.data?.is_agree_child === true &&
    stigmaResult.data?.is_agree_privacy === true,
  );
}

export async function GET() {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims?.userId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401, headers: NO_STORE_HEADERS });
    }

    const state = await getRecoveryEmailState(sessionClaims.userId);

    return Response.json(
      {
        needsRecoveryEmail: state.needsRecoveryEmail,
        hasRecoveryEmail: state.isVerified,
        maskedEmail: state.isVerified ? maskEmail(state.recoveryEmail) : '',
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    return Response.json(
      { error: `${RECOVERY_EMAIL_LABEL} 정보를 불러오지 못했습니다.` },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims?.userId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestBody = (await request.json().catch(() => null)) as RecoveryEmailRequestBody | null;
    const action = requestBody?.action;
    const email = normalizeRecoveryEmail(requestBody?.email);
    const state = await getRecoveryEmailState(sessionClaims.userId);

    if (!state.needsRecoveryEmail) {
      return Response.json({ error: `${RECOVERY_EMAIL_LABEL}을 쓰지 않는 계정입니다.` }, { status: 400 });
    }

    const isSignedUp = await hasCompletedSignUp(sessionClaims.userId);

    if (isSignedUp) {
      const securityState = await getReadSecurityState(sessionClaims, true);

      if (!securityState.isSettingsVerified) {
        return Response.json(
          { error: '본인 확인 후 다시 시도해 주세요.', code: SETTINGS_CHECK_REQUIRED_CODE },
          { status: 403 },
        );
      }
    }

    if (action === 'send') {
      const sendResult = await sendRecoveryEmailCode(sessionClaims.userId, email, state.accountEmail);

      if (!sendResult.ok) {
        return Response.json({ error: sendResult.error }, { status: 400 });
      }

      return Response.json({ ok: true });
    }

    if (action === 'save' && isSignedUp) {
      const code = normalizeRecoveryEmailCode(requestBody?.code);

      if (code.length !== RECOVERY_EMAIL_CODE_LENGTH) {
        return Response.json({ error: '확인 번호 6자리를 입력해 주세요.' }, { status: 400 });
      }

      const verifyResult = await verifyRecoveryEmailCode(sessionClaims.userId, email, code);

      if (!verifyResult.ok) {
        return Response.json({ error: verifyResult.error }, { status: 400 });
      }

      await saveRecoveryEmail(sessionClaims.userId, email);

      return Response.json({ ok: true, maskedEmail: maskEmail(email) });
    }

    return Response.json({ error: '요청을 처리하지 못했습니다.' }, { status: 400 });
  } catch (error) {
    console.error('[recovery-email] request error', error);
    return Response.json(
      {
        error:
          error instanceof Error && error.message
            ? error.message
            : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      },
      { status: 500 },
    );
  }
}
