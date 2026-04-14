import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';
import { redis } from '@/lib/redis';

type SignInRequestBody = {
  email: string | null;
  password: string | null;
  captchaToken: string | null;
};

function getSupabasePublic() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다.');
  }

  if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다.');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getClientIpAddress(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');

  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  if (realIp) {
    return realIp.trim();
  }

  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() ?? 'unknown';
  }

  return 'unknown';
}

function getFailureRedisKey(email: string, clientIpAddress: string) {
  return `sign-in:failure:${email}:${clientIpAddress}`;
}

function getForcedResetRedisKey(email: string, clientIpAddress: string) {
  return `sign-in:forced-reset:${email}:${clientIpAddress}`;
}

async function verifyHCaptchaToken(captchaToken: string, clientIpAddress: string) {
  const hCaptchaSecretKey = process.env.HCAPTCHA_SECRET_KEY;

  if (!hCaptchaSecretKey) {
    throw new Error('HCAPTCHA_SECRET_KEY가 설정되지 않았습니다.');
  }

  const requestBody = new URLSearchParams();
  requestBody.set('secret', hCaptchaSecretKey);
  requestBody.set('response', captchaToken);
  requestBody.set('remoteip', clientIpAddress);

  const verifyResponse = await fetch('https://api.hcaptcha.com/siteverify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: requestBody.toString(),
  });

  if (!verifyResponse.ok) {
    throw new Error('hCaptcha 검증 요청에 실패했습니다.');
  }

  const verifyResult = (await verifyResponse.json()) as {
    success?: boolean;
  };

  return Boolean(verifyResult.success);
}

async function forceResetPassword(email: string, requestOrigin: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const supabasePublic = getSupabasePublic();

  const particlesResult = await supabaseAdmin.from('particles').select('id').eq('email', email).maybeSingle();

  if (particlesResult.error) {
    throw new Error(particlesResult.error.message);
  }

  if (!particlesResult.data?.id) {
    return;
  }

  const randomPassword = `${crypto.randomUUID()}-${Date.now()}`;

  const updateUserResult = await supabaseAdmin.auth.admin.updateUserById(particlesResult.data.id, {
    password: randomPassword,
  });

  if (updateUserResult.error) {
    throw new Error(updateUserResult.error.message);
  }

  const resetPasswordResult = await supabasePublic.auth.resetPasswordForEmail(email, {
    redirectTo: `${requestOrigin}/reset-password`,
  });

  if (resetPasswordResult.error) {
    throw new Error(resetPasswordResult.error.message);
  }
}

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as SignInRequestBody;

    const email = requestBody.email?.trim().toLowerCase() ?? '';
    const password = requestBody.password ?? '';
    const captchaToken = requestBody.captchaToken?.trim() ?? '';
    const clientIpAddress = getClientIpAddress(request);
    const requestOrigin = new URL(request.url).origin;

    if (!email) {
      return Response.json({ error: '이메일을 입력해주세요.' }, { status: 400 });
    }

    if (!password) {
      return Response.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 });
    }

    const failureRedisKey = getFailureRedisKey(email, clientIpAddress);
    const forcedResetRedisKey = getForcedResetRedisKey(email, clientIpAddress);

    const failureCountValue = await redis.get<number>(failureRedisKey);
    const failureCount = Number(failureCountValue ?? 0);

    if (failureCount >= 5) {
      if (!captchaToken) {
        return Response.json(
          {
            error: 'hCaptcha 확인이 필요합니다.',
            code: 'captcha_required',
            captchaRequired: true,
          },
          { status: 400 },
        );
      }

      const isCaptchaValid = await verifyHCaptchaToken(captchaToken, clientIpAddress);

      if (!isCaptchaValid) {
        return Response.json(
          {
            error: 'hCaptcha 확인에 실패했습니다.',
            code: 'captcha_invalid',
            captchaRequired: true,
          },
          { status: 400 },
        );
      }
    }

    const supabasePublic = getSupabasePublic();

    const signInResult = await supabasePublic.auth.signInWithPassword({
      email,
      password,
    });

    if (signInResult.error) {
      const nextFailureCount = await redis.incr(failureRedisKey);

      if (nextFailureCount === 1) {
        await redis.expire(failureRedisKey, 60 * 60);
      }

      const captchaRequired = nextFailureCount >= 5;

      if (signInResult.error.code === 'email_not_confirmed') {
        return Response.json(
          {
            error: '이메일 인증이 완료되지 않았습니다. 메일함에서 인증 링크를 확인해주세요.',
            code: 'email_not_confirmed',
            captchaRequired,
          },
          { status: 401 },
        );
      }

      if (nextFailureCount >= 10) {
        const forcedResetHandled = await redis.get<string>(forcedResetRedisKey);

        if (!forcedResetHandled) {
          await forceResetPassword(email, requestOrigin);
          await redis.set(forcedResetRedisKey, '1', { ex: 60 * 60 });
        }

        return Response.json(
          {
            error: '로그인 시도가 너무 많아 비밀번호를 초기화했습니다. 가입된 이메일이라면 메일함을 확인해주세요.',
            code: 'password_force_reset',
            captchaRequired: true,
          },
          { status: 401 },
        );
      }

      return Response.json(
        {
          error: '이메일 또는 비밀번호가 올바르지 않습니다.',
          code: 'invalid_credentials',
          captchaRequired,
        },
        { status: 401 },
      );
    }

    await redis.del(failureRedisKey);
    await redis.del(forcedResetRedisKey);

    const authSession = signInResult.data.session;

    if (!authSession) {
      return Response.json({ error: '세션은 만들지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      accessToken: authSession.access_token,
      refreshToken: authSession.refresh_token,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
