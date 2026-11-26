import crypto from 'crypto';
import { redis } from '@/lib/clients/redis';

export const CAPTCHA_PURPOSES = ['sign-up', 'site-new', 'blog-post'] as const;

export type CaptchaPurpose = (typeof CAPTCHA_PURPOSES)[number];

export type FCaptchaResult = 'passed' | 'rejected' | 'unavailable';

const PASS_LIFETIME_MS: Record<CaptchaPurpose, number> = {
  'sign-up': 30 * 60 * 1000,
  'site-new': 30 * 60 * 1000,
  'blog-post': 12 * 60 * 60 * 1000,
};

export const CAPTCHA_REQUIRED_MESSAGE = '보안 확인 시간이 지났습니다. 보안 확인을 다시 완료해 주세요.';
const FCAPTCHA_SERVER_URL = 'https://fcaptcha.webdecoy.com';
const FCAPTCHA_UNAVAILABLE_KEY = 'captcha:fcaptcha-unavailable';
const FCAPTCHA_UNAVAILABLE_SECONDS = 10 * 60;
const FCAPTCHA_DIAGNOSTIC_TOKEN = 'fcaptcha-diagnostic';

type PassPayload = {
  kind: 'captcha-pass';
  purpose: CaptchaPurpose;
  subject: string;
  expiresAt: number;
};

type SiteVerifyResult = {
  success?: boolean;
  hostname?: string;
  'error-codes'?: string[];
};

export function isLoginCaptchaPurpose(purpose: CaptchaPurpose) {
  return purpose !== 'sign-up';
}

export function isCaptchaPurpose(value: unknown): value is CaptchaPurpose {
  return typeof value === 'string' && (CAPTCHA_PURPOSES as readonly string[]).includes(value);
}

function getSecret() {
  const encryptionSecret = process.env.ENCRYPTION_SECRET;

  if (!encryptionSecret) {
    throw new Error('ENCRYPTION_SECRET가 설정되지 않았습니다.');
  }

  return `captcha:${encryptionSecret}`;
}

function createSignature(value: string) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('base64url');
}

async function postSiteVerify(url: string, secret: string, token: string, clientIpAddress: string | null) {
  const requestBody = new URLSearchParams();
  requestBody.set('secret', secret);
  requestBody.set('response', token);

  if (clientIpAddress) {
    requestBody.set('remoteip', clientIpAddress);
  }

  const verifyResponse = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: requestBody.toString(),
    signal: AbortSignal.timeout(8000),
  });

  return {
    ok: verifyResponse.ok,
    status: verifyResponse.status,
    result: (await verifyResponse.json().catch(() => null)) as SiteVerifyResult | null,
  };
}

function getFCaptchaSecret() {
  const secret = process.env.FCAPTCHA_SECRET;

  if (!secret) {
    throw new Error('FCAPTCHA_SECRET가 설정되지 않았습니다.');
  }

  return secret;
}

async function markFCaptchaUnavailable() {
  await redis.set(FCAPTCHA_UNAVAILABLE_KEY, '1', { ex: FCAPTCHA_UNAVAILABLE_SECONDS }).catch(() => null);
}

export async function isFCaptchaUnavailable() {
  const value = await redis.get<string>(FCAPTCHA_UNAVAILABLE_KEY).catch(() => null);

  return Boolean(value);
}

export async function verifyFCaptchaToken(
  token: string,
  clientIpAddress: string | null,
  requestHostname: string,
): Promise<FCaptchaResult> {
  try {
    const { ok, status, result } = await postSiteVerify(
      `${FCAPTCHA_SERVER_URL}/siteverify`,
      getFCaptchaSecret(),
      token,
      clientIpAddress,
    );

    if (result?.['error-codes']?.includes('capacity-exceeded') || status >= 500 || !result) {
      await markFCaptchaUnavailable();
      return 'unavailable';
    }

    if (!ok || result.success !== true) {
      return 'rejected';
    }

    return !result.hostname || result.hostname === requestHostname ? 'passed' : 'rejected';
  } catch {
    await markFCaptchaUnavailable();
    return 'unavailable';
  }
}

export async function checkFCaptchaAvailability() {
  if (await isFCaptchaUnavailable()) {
    return false;
  }

  try {
    const { status, result } = await postSiteVerify(
      `${FCAPTCHA_SERVER_URL}/siteverify`,
      getFCaptchaSecret(),
      FCAPTCHA_DIAGNOSTIC_TOKEN,
      null,
    );

    if (result?.['error-codes']?.includes('capacity-exceeded') || status >= 500 || !result) {
      await markFCaptchaUnavailable();
      return false;
    }

    return true;
  } catch {
    await markFCaptchaUnavailable();
    return false;
  }
}

export async function verifyTurnstileToken(token: string, clientIpAddress: string | null) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('TURNSTILE_SECRET_KEY가 설정되지 않았습니다.');
  }

  const { ok, result } = await postSiteVerify(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    secretKey,
    token,
    clientIpAddress,
  );

  return ok && result?.success === true;
}

export function createCaptchaPassToken(purpose: CaptchaPurpose, subject: string) {
  const payload: PassPayload = {
    kind: 'captcha-pass',
    purpose,
    subject,
    expiresAt: Date.now() + PASS_LIFETIME_MS[purpose],
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

  return `${encodedPayload}.${createSignature(encodedPayload)}`;
}

export function isCaptchaPassed(passToken: string, purpose: CaptchaPurpose, subject: string) {
  const [encodedPayload, signature, extra] = passToken.split('.');

  if (!encodedPayload || !signature || extra !== undefined) {
    return false;
  }

  const expectedSignature = Buffer.from(createSignature(encodedPayload));
  const receivedSignature = Buffer.from(signature);

  if (
    expectedSignature.length !== receivedSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<PassPayload>;

    return (
      payload.kind === 'captcha-pass' &&
      payload.purpose === purpose &&
      payload.subject === subject &&
      typeof payload.expiresAt === 'number' &&
      payload.expiresAt >= Date.now()
    );
  } catch {
    return false;
  }
}
