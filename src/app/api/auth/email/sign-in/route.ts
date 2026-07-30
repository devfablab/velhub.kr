import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { getMailFrom, getResendClient } from '@/lib/resend';
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

  const generateLinkResult = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${requestOrigin}/reset-password` },
  });

  if (generateLinkResult.error || !generateLinkResult.data.properties.action_link) {
    throw new Error(generateLinkResult.error?.message || '비밀번호 재설정 링크를 만들지 못했습니다.');
  }

  const sendResult = await getResendClient().emails.send({
    from: getMailFrom(),
    to: email,
    subject: '[데브허브] 비밀번호를 재설정해 주세요',
    html: `
      <table style="border-collapse:collapse;width:100%;border-style:none;margin-left:auto;margin-right:auto" border="0">
        <tr><td style="background-color:#181818"><div style="max-width:575px;width:100%;padding:23px;box-sizing:border-box;margin:0 auto"><img style="border-style:none" src="https://velhub.xyz/velhub-1-webmail.png" alt="데브허브" width="106" height="24"></div></td></tr>
        <tr><td><div style="max-width:575px;width:100%;padding:23px;margin:0 auto;box-sizing:border-box;font-family:'Apple SD Gothic Neo', 'Noto Sans KR','Malgun Gothic', '맑은 고딕', sans-serif;color:#181818;"><h1>데브허브 비밀번호 재설정</h1><p>콘텐츠에 가치를 더하는 복합 허브 서비스, 데브허브입니다.</p><p>아래 버튼을 눌러 새 비밀번호를 설정해 주세요.</p><p style="text-align:center"><a href="${generateLinkResult.data.properties.action_link}" style="background-color:#eeb400;color:#181818;display:inline-block;padding:12px 23px;border-radius:12px;font-weight:bolder;text-decoration:none">비밀번호 재설정</a></p><p>본인이 요청하지 않았다면 이 이메일을 무시해 주세요. 기존 비밀번호는 변경되지 않습니다.</p><p><strong style="font-size:12px">Everyday, Everywhere, Everymoments - Velhub</strong></p></div></td></tr>
        <tr><td style="background-color:#181818"><div style="max-width:575px;width:100%;padding:23px;margin:0 auto;box-sizing:border-box;font-family:'Apple SD Gothic Neo', 'Noto Sans KR','Malgun Gothic', '맑은 고딕', sans-serif;"><span style="color:#d7d7d7;font-size:12px">&copy; <img src="https://velhub.xyz/velhub-2-webmail.png" alt="데브런닷스튜디오" width="90" height="12"> All rights reserved. <strong style="color:#ff69b4;padding-left:12px">&hearts; velhub</strong></span></div></td></tr>
      </table>
    `,
  });

  if (sendResult.error) {
    throw new Error(sendResult.error.message || '비밀번호 재설정 메일을 보내지 못했습니다.');
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
