import crypto from 'crypto';
import {
  getRecoveryEmailErrorMessage,
  getUsableAccountEmail,
  RECOVERY_EMAIL_CODE_VALID_SECONDS,
  RECOVERY_EMAIL_LABEL,
} from '@/lib/auth/recoveryEmail';
import { redis } from '@/lib/clients/redis';
import { getMailFrom, getResendClient } from '@/lib/clients/resend';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { createLookupHash, encrypt } from '@/lib/encryption/encrypt';

type RecoveryEmailCodeRecord = {
  emailHash: string;
  codeHash: string;
  attempts: number;
};

export type RecoveryEmailState = {
  accountEmail: string;
  recoveryEmail: string;
  isVerified: boolean;
  needsRecoveryEmail: boolean;
};

const CODE_ATTEMPT_LIMIT = 5;
const SEND_INTERVAL_SECONDS = 60;
const MAIL_STYLE = "font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#181818;line-height:1.6";

function getCodeKey(userId: string) {
  return `recovery-email:code:${userId}`;
}

function getSendIntervalKey(userId: string) {
  return `recovery-email:send:${userId}`;
}

function getEmailHash(userId: string, email: string) {
  return createLookupHash(`recovery-email:${userId}:${email}`);
}

function getCodeHash(userId: string, code: string) {
  return createLookupHash(`recovery-email-code:${userId}:${code}`);
}

function isSameHash(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function decryptEmail(value: string | null | undefined) {
  if (!value) return '';

  try {
    return decrypt(value).trim().toLowerCase();
  } catch {
    return '';
  }
}

async function sendMail(to: string, subject: string, html: string) {
  const sendResult = await getResendClient().emails.send({ from: getMailFrom(), to, subject, html });

  if (sendResult.error) {
    console.error('[recovery-email] email send error', sendResult.error);
    throw new Error('이메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
}

export async function getRecoveryEmailState(userId: string): Promise<RecoveryEmailState> {
  const supabaseAdmin = getSupabaseAdmin();
  const [authUserResult, stigmaResult] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(userId),
    supabaseAdmin
      .from('stigmas')
      .select('payment_email, payment_email_verified_at')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (authUserResult.error || !authUserResult.data.user || stigmaResult.error) {
    throw new Error('계정 정보를 확인하지 못했습니다.');
  }

  const authUser = authUserResult.data.user;
  const accountEmail = getUsableAccountEmail(authUser.email);
  const hasPassword =
    Boolean(accountEmail) && Boolean(authUser.identities?.some((identity) => identity.provider === 'email'));
  const recoveryEmail = decryptEmail(stigmaResult.data?.payment_email as string | null | undefined);
  const isVerified = Boolean(recoveryEmail && stigmaResult.data?.payment_email_verified_at);

  return {
    accountEmail,
    recoveryEmail,
    isVerified,
    needsRecoveryEmail: !hasPassword,
  };
}

export async function isRecoveryEmailLocked(userId: string) {
  const stigmaResult = await getSupabaseAdmin()
    .from('stigmas')
    .select('payment_email_verified_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (stigmaResult.error) {
    throw new Error('계정 정보를 확인하지 못했습니다.');
  }

  return Boolean(stigmaResult.data?.payment_email_verified_at);
}

export async function getVerifiedRecoveryEmail(userId: string) {
  const stigmaResult = await getSupabaseAdmin()
    .from('stigmas')
    .select('payment_email, payment_email_verified_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (stigmaResult.error || !stigmaResult.data?.payment_email_verified_at) {
    return '';
  }

  return decryptEmail(stigmaResult.data.payment_email as string | null);
}

export async function sendRecoveryEmailCode(userId: string, email: string, accountEmail: string) {
  const errorMessage = getRecoveryEmailErrorMessage(email, accountEmail);

  if (errorMessage) {
    return { ok: false as const, error: errorMessage };
  }

  const canSend = await redis.set(getSendIntervalKey(userId), 1, { nx: true, ex: SEND_INTERVAL_SECONDS });

  if (!canSend) {
    return { ok: false as const, error: '확인 번호는 1분에 한 번만 받을 수 있습니다. 잠시 후 다시 시도해 주세요.' };
  }

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

  try {
    await sendMail(
      email,
      `[데브허브] ${RECOVERY_EMAIL_LABEL} 확인 번호`,
      `<div style="${MAIL_STYLE}"><h1>${RECOVERY_EMAIL_LABEL} 확인 번호</h1><p>아래 6자리 확인 번호를 데브허브 화면에 입력해 주세요. 확인 번호는 10분 동안만 쓸 수 있습니다.</p><p style="font-size:28px;font-weight:700;letter-spacing:8px">${code}</p><p>직접 요청하지 않았다면 이 메일은 무시해 주세요.</p></div>`,
    );
  } catch (error) {
    await redis.del(getSendIntervalKey(userId));
    throw error;
  }

  const record: RecoveryEmailCodeRecord = {
    emailHash: getEmailHash(userId, email),
    codeHash: getCodeHash(userId, code),
    attempts: 0,
  };
  await redis.set(getCodeKey(userId), record, { ex: RECOVERY_EMAIL_CODE_VALID_SECONDS });

  return { ok: true as const };
}

export async function verifyRecoveryEmailCode(userId: string, email: string, code: string) {
  const record = await redis.get<RecoveryEmailCodeRecord>(getCodeKey(userId));

  if (!record) {
    return { ok: false as const, error: '확인 번호가 만료되었습니다. 확인 번호를 다시 받아 주세요.' };
  }

  if (!isSameHash(record.emailHash, getEmailHash(userId, email))) {
    return { ok: false as const, error: '확인 번호를 받은 이메일과 입력한 이메일이 다릅니다.' };
  }

  if (!isSameHash(record.codeHash, getCodeHash(userId, code))) {
    const attempts = record.attempts + 1;

    if (attempts >= CODE_ATTEMPT_LIMIT) {
      await redis.del(getCodeKey(userId));
      return { ok: false as const, error: '확인 번호를 여러 번 틀렸습니다. 확인 번호를 다시 받아 주세요.' };
    }

    const timeToLive = await redis.ttl(getCodeKey(userId));
    await redis.set(
      getCodeKey(userId),
      { ...record, attempts },
      { ex: timeToLive > 0 ? timeToLive : RECOVERY_EMAIL_CODE_VALID_SECONDS },
    );
    return { ok: false as const, error: '확인 번호가 맞지 않습니다.' };
  }

  await redis.del(getCodeKey(userId));
  return { ok: true as const };
}

export async function saveRecoveryEmail(userId: string, email: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const previousResult = await supabaseAdmin
    .from('stigmas')
    .select('payment_email, payment_email_verified_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (previousResult.error) {
    throw new Error(`${RECOVERY_EMAIL_LABEL}을 저장하지 못했습니다.`);
  }

  const previousEmail = previousResult.data?.payment_email_verified_at
    ? decryptEmail(previousResult.data.payment_email as string | null)
    : '';

  const updateResult = await supabaseAdmin
    .from('stigmas')
    .update({ payment_email: encrypt(email), payment_email_verified_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (updateResult.error) {
    throw new Error(`${RECOVERY_EMAIL_LABEL}을 저장하지 못했습니다.`);
  }

  if (previousEmail && previousEmail !== email) {
    await sendMail(
      previousEmail,
      `[데브허브] ${RECOVERY_EMAIL_LABEL}이 바뀌었습니다`,
      `<div style="${MAIL_STYLE}"><h1>${RECOVERY_EMAIL_LABEL}이 바뀌었습니다</h1><p>데브허브 계정의 ${RECOVERY_EMAIL_LABEL}이 다른 주소로 바뀌었습니다. 앞으로 이 주소로는 인증번호와 임시 보안 비밀번호가 가지 않습니다.</p><p>직접 바꾸지 않았다면 바로 데브허브 컨시어지로 문의해 주세요.</p></div>`,
    ).catch((error) => console.error('[recovery-email] change notice error', error));
  }
}
