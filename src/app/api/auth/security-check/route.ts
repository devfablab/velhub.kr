import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import {
  clearSecurityCheckFailures,
  clearSecurityEmailCode,
  completeAccessCheck,
  completeSettingsCheck,
  getSecurityCheckMethods,
  recordSecurityCheckFailure,
  revokeAllSessions,
  SECURITY_CHECK_FAILURE_LIMIT,
  sendSecurityEmailCode,
  verifySecurityEmailCode,
  verifySecurityPin,
} from '@/lib/auth/securityCheck.server';
import { isSecurityPinFormat, normalizeSecurityPin } from '@/lib/auth/securityPin';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { clearCurrentSessionClaimsCache, getSessionClaims } from '@/lib/session/server';

type SecurityCheckRequestBody = {
  action?: unknown;
  purpose?: unknown;
  password?: unknown;
  totpCode?: unknown;
  emailCode?: unknown;
  pin?: unknown;
};

function getSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error('Supabase URL이 설정되지 않았습니다.');
  return value;
}

function getSupabaseBrowserKey() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) throw new Error('Supabase 공개 키가 설정되지 않았습니다.');
  return value;
}

async function getSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseBrowserKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });
}

function getText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

async function isPasswordCorrect(userId: string, password: string) {
  const authUserResult = await getSupabaseAdmin().auth.admin.getUserById(userId);
  const email = authUserResult.data.user?.email;

  if (authUserResult.error || !email) {
    throw new Error('계정 정보를 확인하지 못했습니다.');
  }

  const passwordCheckClient = createClient(getSupabaseUrl(), getSupabaseBrowserKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signInResult = await passwordCheckClient.auth.signInWithPassword({ email, password });

  if (signInResult.error) {
    return false;
  }

  await passwordCheckClient.auth.signOut({ scope: 'local' });
  return true;
}

async function isTotpCodeCorrect(code: string) {
  const supabase = await getSupabaseServer();
  const factorsResult = await supabase.auth.mfa.listFactors();
  const factor = factorsResult.data?.totp?.find((totpFactor) => totpFactor.status === 'verified');

  if (factorsResult.error || !factor) {
    throw new Error('설정된 2단계 인증 정보를 찾지 못했습니다.');
  }

  const verifyResult = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });

  if (verifyResult.error?.status === 429) {
    throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
  }

  return !verifyResult.error;
}

export async function GET() {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims?.userId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const methods = await getSecurityCheckMethods(sessionClaims.userId, sessionClaims.hasTotp);
    return Response.json({ ok: true, methods });
  } catch (unknownError) {
    const message = unknownError instanceof Error ? unknownError.message : '';
    return Response.json({ error: message || '본인 확인 방법을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims?.userId || !sessionClaims.sessionId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as SecurityCheckRequestBody;
    const action = getText(body.action);
    const methods = await getSecurityCheckMethods(sessionClaims.userId, sessionClaims.hasTotp);

    if (action === 'send-email-code') {
      if (!methods.emailPin) {
        return Response.json({ error: '이메일 인증번호를 쓰지 않는 계정입니다.' }, { status: 400 });
      }

      const maskedEmail = await sendSecurityEmailCode(sessionClaims.userId, sessionClaims.sessionId);
      return Response.json({ ok: true, maskedEmail });
    }

    if (action !== 'verify') {
      return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }

    const purpose = getText(body.purpose) === 'settings' ? 'settings' : 'access';
    const password = getText(body.password);
    const totpCode = normalizeSecurityPin(getText(body.totpCode));
    const emailCode = normalizeSecurityPin(getText(body.emailCode));
    const pin = normalizeSecurityPin(getText(body.pin));

    if (
      (methods.password && !password) ||
      (methods.totp && !isSecurityPinFormat(totpCode)) ||
      (methods.emailPin && (!isSecurityPinFormat(emailCode) || !isSecurityPinFormat(pin)))
    ) {
      return Response.json({ error: '본인 확인 정보를 모두 입력해 주세요.' }, { status: 400 });
    }

    const isPasswordValid = !methods.password || (await isPasswordCorrect(sessionClaims.userId, password));
    const isTotpValid = !methods.totp || !isPasswordValid || (await isTotpCodeCorrect(totpCode));
    const isEmailCodeValid = !methods.emailPin || (await verifySecurityEmailCode(sessionClaims.sessionId, emailCode));
    const isPinValid = !methods.emailPin || (await verifySecurityPin(sessionClaims.userId, pin));

    if (!isPasswordValid || !isTotpValid || !isEmailCodeValid || !isPinValid) {
      const failureCount = await recordSecurityCheckFailure(sessionClaims.userId);

      if (failureCount >= SECURITY_CHECK_FAILURE_LIMIT) {
        const supabase = await getSupabaseServer();
        await revokeAllSessions(sessionClaims);
        await supabase.auth.signOut({ scope: 'global' });
        await clearCurrentSessionClaimsCache();

        return Response.json(
          {
            error: '모든 기기에서 로그아웃되었습니다.',
            loggedOut: true,
          },
          { status: 403 },
        );
      }

      return Response.json(
        {
          error: '입력한 정보가 올바르지 않습니다.',
        },
        { status: 400 },
      );
    }

    const headerList = await headers();

    await clearSecurityCheckFailures(sessionClaims.userId);
    await clearSecurityEmailCode(sessionClaims.sessionId);

    if (purpose === 'settings') {
      await completeSettingsCheck(sessionClaims, headerList);
    } else {
      await completeAccessCheck(sessionClaims, headerList);
    }

    return Response.json({ ok: true });
  } catch (unknownError) {
    const message = unknownError instanceof Error ? unknownError.message : '';
    return Response.json({ error: message || '본인 확인에 실패했습니다.' }, { status: 500 });
  }
}
