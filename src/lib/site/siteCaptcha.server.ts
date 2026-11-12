import crypto from 'crypto';
import svgCaptcha from 'svg-captcha';

export const SITE_CAPTCHA_MAX_FAILURES = 3;

const CHALLENGE_LIFETIME_MS = 10 * 60 * 1000;
const PASS_LIFETIME_MS = 30 * 60 * 1000;

type ChallengePayload = {
  kind: 'site-captcha-challenge';
  userId: string;
  nonce: string;
  answerHash: string;
  failureCount: number;
  expiresAt: number;
};

type PassPayload = {
  kind: 'site-captcha-pass';
  userId: string;
  expiresAt: number;
};

export type SiteCaptchaChallenge = {
  image: string;
  challengeToken: string;
  failureCount: number;
};

export type SiteCaptchaAnswerResult =
  | { status: 'passed'; passToken: string }
  | { status: 'failed'; remainingCount: number; challenge: SiteCaptchaChallenge }
  | { status: 'blocked' }
  | { status: 'expired'; challenge: SiteCaptchaChallenge };

function getSecret() {
  const encryptionSecret = process.env.ENCRYPTION_SECRET;

  if (!encryptionSecret) {
    throw new Error('ENCRYPTION_SECRET가 설정되지 않았습니다.');
  }

  return `site-captcha:${encryptionSecret}`;
}

function createSignature(value: string) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('base64url');
}

function signPayload(payload: ChallengePayload | PassPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

  return `${encodedPayload}.${createSignature(encodedPayload)}`;
}

function readPayload(token: string): Record<string, unknown> | null {
  const [encodedPayload, signature, extra] = token.split('.');

  if (!encodedPayload || !signature || extra !== undefined) {
    return null;
  }

  const expectedSignature = Buffer.from(createSignature(encodedPayload));
  const receivedSignature = Buffer.from(signature);

  if (
    expectedSignature.length !== receivedSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

    return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function normalizeAnswer(value: string) {
  return value.replace(/\s+/g, '').toLowerCase();
}

function hashAnswer(nonce: string, answer: string) {
  return createSignature(`${nonce}:${normalizeAnswer(answer)}`);
}

function readChallenge(token: string, userId: string): ChallengePayload | null {
  const payload = readPayload(token);

  if (
    !payload ||
    payload.kind !== 'site-captcha-challenge' ||
    payload.userId !== userId ||
    typeof payload.nonce !== 'string' ||
    typeof payload.answerHash !== 'string' ||
    typeof payload.failureCount !== 'number' ||
    typeof payload.expiresAt !== 'number'
  ) {
    return null;
  }

  return payload as ChallengePayload;
}

export function createSiteCaptchaChallenge(userId: string, failureCount = 0): SiteCaptchaChallenge {
  const captcha = svgCaptcha.create({
    size: 5,
    width: 160,
    height: 56,
    fontSize: 52,
    noise: 3,
    color: false,
    background: '#ffffff',
    ignoreChars: '0oO1iIlLjJ',
  });
  const nonce = crypto.randomUUID();

  return {
    image: captcha.data,
    failureCount,
    challengeToken: signPayload({
      kind: 'site-captcha-challenge',
      userId,
      nonce,
      answerHash: hashAnswer(nonce, captcha.text),
      failureCount,
      expiresAt: Date.now() + CHALLENGE_LIFETIME_MS,
    }),
  };
}

export function refreshSiteCaptchaChallenge(userId: string, challengeToken: string): SiteCaptchaChallenge | null {
  const challenge = readChallenge(challengeToken, userId);
  const failureCount = challenge?.failureCount ?? 0;

  return failureCount >= SITE_CAPTCHA_MAX_FAILURES ? null : createSiteCaptchaChallenge(userId, failureCount);
}

export function checkSiteCaptchaAnswer(
  userId: string,
  challengeToken: string,
  answer: string,
): SiteCaptchaAnswerResult {
  const challenge = readChallenge(challengeToken, userId);

  if (!challenge) {
    return { status: 'expired', challenge: createSiteCaptchaChallenge(userId) };
  }

  if (challenge.failureCount >= SITE_CAPTCHA_MAX_FAILURES) {
    return { status: 'blocked' };
  }

  if (challenge.expiresAt < Date.now()) {
    return { status: 'expired', challenge: createSiteCaptchaChallenge(userId, challenge.failureCount) };
  }

  const expectedHash = Buffer.from(challenge.answerHash);
  const receivedHash = Buffer.from(hashAnswer(challenge.nonce, answer));

  if (expectedHash.length === receivedHash.length && crypto.timingSafeEqual(expectedHash, receivedHash)) {
    return {
      status: 'passed',
      passToken: signPayload({ kind: 'site-captcha-pass', userId, expiresAt: Date.now() + PASS_LIFETIME_MS }),
    };
  }

  const failureCount = challenge.failureCount + 1;

  if (failureCount >= SITE_CAPTCHA_MAX_FAILURES) {
    return { status: 'blocked' };
  }

  return {
    status: 'failed',
    remainingCount: SITE_CAPTCHA_MAX_FAILURES - failureCount,
    challenge: createSiteCaptchaChallenge(userId, failureCount),
  };
}

export function isSiteCaptchaPassed(userId: string, passToken: string) {
  const payload = readPayload(passToken);

  return (
    payload?.kind === 'site-captcha-pass' &&
    payload.userId === userId &&
    typeof payload.expiresAt === 'number' &&
    payload.expiresAt >= Date.now()
  );
}
