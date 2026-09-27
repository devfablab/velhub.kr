import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { consumeTotpRecoveryCode } from '@/lib/auth/totpRecovery.server';
import { redis } from '@/lib/redis';
import { clearCurrentSessionClaimsCache, getSessionClaims } from '@/lib/session';

const RECOVERY_FAILURE_LIMIT = 5;
const RECOVERY_FAILURE_WINDOW_SECONDS = 15 * 60;

function getRecoveryFailureKey(userId: string, sessionId: string) {
  return `totp-recovery:failure:${userId}:${sessionId}`;
}

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { factorId?: unknown; code?: unknown };
    const factorId = typeof body.factorId === 'string' ? body.factorId.trim() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';

    if (!/^\d{6}$/.test(code)) {
      return Response.json(
        {
          title: '2단계 인증 확인',
          errors: ['인증 코드는 숫자 6자리로 입력해 주세요.'],
          fieldError: '인증 코드는 숫자 6자리로 입력해 주세요.',
        },
        { status: 400 },
      );
    }

    if (!factorId) {
      return Response.json(
        { title: '2단계 인증 확인', errors: ['설정된 2단계 인증 정보를 찾지 못했습니다.'] },
        { status: 400 },
      );
    }

    const supabase = await getSupabaseServer();
    const userResult = await supabase.auth.getUser();

    if (userResult.error || !userResult.data.user) {
      return Response.json(
        { title: '로그인 정보 확인', errors: ['로그인 정보가 만료되었습니다. 다시 로그인해 주세요.'] },
        { status: 401 },
      );
    }

    const factorsResult = await supabase.auth.mfa.listFactors();
    const hasFactor = factorsResult.data?.totp?.some(
      (factor) => factor.id === factorId && factor.status === 'verified',
    );

    if (factorsResult.error || !hasFactor) {
      return Response.json(
        { title: '2단계 인증 확인', errors: ['설정된 2단계 인증 정보를 찾지 못했습니다.'] },
        { status: 400 },
      );
    }

    const verifyResult = await supabase.auth.mfa.challengeAndVerify({ factorId, code });

    if (verifyResult.error) {
      if (verifyResult.error.status === 429) {
        return Response.json(
          { title: '2단계 인증 확인', errors: ['요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'] },
          { status: 429 },
        );
      }

      if (verifyResult.error.status === 400 || verifyResult.error.status === 422) {
        const sessionClaims = await getSessionClaims();
        const recovered =
          sessionClaims?.userId === userResult.data.user.id && sessionClaims.sessionId
            ? await consumeTotpRecoveryCode(sessionClaims.userId, sessionClaims.sessionId, code)
            : false;

        if (recovered) {
          if (sessionClaims?.userId && sessionClaims.sessionId) {
            await redis.del(getRecoveryFailureKey(sessionClaims.userId, sessionClaims.sessionId));
          }
          await clearCurrentSessionClaimsCache();
          return Response.json({ ok: true, recoveryCodeUsed: true });
        }

        if (sessionClaims?.userId && sessionClaims.sessionId) {
          const failureKey = getRecoveryFailureKey(sessionClaims.userId, sessionClaims.sessionId);
          const failureCount = await redis.incr(failureKey);
          if (failureCount === 1) await redis.expire(failureKey, RECOVERY_FAILURE_WINDOW_SECONDS);
          if (failureCount >= RECOVERY_FAILURE_LIMIT) {
            return Response.json(
              { title: '2단계 인증 확인', errors: ['인증 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'] },
              { status: 429 },
            );
          }
        }

        return Response.json(
          {
            title: '2단계 인증 확인',
            errors: ['인증 코드가 올바르지 않습니다.'],
            fieldError: '인증 코드가 올바르지 않습니다.',
          },
          { status: 400 },
        );
      }

      console.error('[mfa-verify] verify error', verifyResult.error);
      return Response.json(
        { errors: ['2단계 인증 확인에 실패했습니다.\n잠시 후 다시 시도해 주세요.'] },
        { status: 500 },
      );
    }

    return Response.json({ ok: true });
  } catch (unknownError) {
    console.error('[mfa-verify] unexpected error', unknownError);
    return Response.json({ errors: ['2단계 인증 확인에 실패했습니다.\n잠시 후 다시 시도해 주세요.'] }, { status: 500 });
  }
}
