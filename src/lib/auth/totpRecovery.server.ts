import crypto from 'crypto';
import { decrypt } from '@/lib/encryption/decrypt';
import { createLookupHash } from '@/lib/encryption/encrypt';
import { getMailFrom, getResendClient } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createRecoveryCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function getRecoveryCodeHash(userId: string, code: string) {
  return createLookupHash(`totp-recovery:${userId}:${code}`);
}

function decryptEmail(value: string | null) {
  if (!value) return '';

  try {
    return decrypt(value).trim().toLowerCase();
  } catch {
    return '';
  }
}

async function getRecoveryRecipient(userId: string) {
  const stigmaResult = await getSupabaseAdmin()
    .from('stigmas')
    .select('email, payment_email')
    .eq('user_id', userId)
    .maybeSingle();

  if (stigmaResult.error || !stigmaResult.data) {
    throw new Error('복구 코드를 받을 이메일을 확인하지 못했습니다.');
  }

  const paymentEmail = decryptEmail(stigmaResult.data.payment_email);
  const accountEmail = decryptEmail(stigmaResult.data.email);
  const email = paymentEmail || accountEmail;

  if (!EMAIL_PATTERN.test(email) || email.endsWith('@auth.velhub.local')) {
    throw new Error('복구 코드를 받을 이메일을 확인하지 못했습니다.');
  }

  return email;
}

async function sendRecoveryCode(email: string, code: string) {
  const sendResult = await getResendClient().emails.send({
    from: getMailFrom(),
    to: email,
    subject: '[데브허브] 2단계 인증 복구 코드',
    html: `<div style="font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#181818;line-height:1.6"><h1>2단계 인증 복구 코드</h1><p>아래 6자리 복구 코드를 2단계 인증 화면에 입력해 주세요.</p><p style="font-size:28px;font-weight:700;letter-spacing:8px">${code}</p><p>복구 코드를 사용하면 새 코드가 발급되며, 기존 코드는 더 이상 사용할 수 없습니다.</p></div>`,
  });

  if (sendResult.error) {
    console.error('[totp-recovery] email send error', sendResult.error);
    throw new Error('복구 코드를 이메일로 보내지 못했습니다.');
  }
}

export async function issueTotpRecoveryCode(userId: string) {
  const email = await getRecoveryRecipient(userId);
  const code = createRecoveryCode();

  await sendRecoveryCode(email, code);

  const upsertResult = await getSupabaseAdmin()
    .from('totp_recovery_codes')
    .upsert({
      user_id: userId,
      code_hash: getRecoveryCodeHash(userId, code),
      issued_at: new Date().toISOString(),
      used_at: null,
      verified_session_id: null,
      verified_at: null,
    });

  if (upsertResult.error) {
    console.error('[totp-recovery] code save error', upsertResult.error);
    throw new Error('복구 코드를 저장하지 못했습니다.');
  }
}

export async function consumeTotpRecoveryCode(userId: string, sessionId: string, code: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const codeHash = getRecoveryCodeHash(userId, code);
  const codeResult = await supabaseAdmin
    .from('totp_recovery_codes')
    .select('code_hash')
    .eq('user_id', userId)
    .maybeSingle();

  if (codeResult.error) {
    console.error('[totp-recovery] code select error', codeResult.error);
    throw new Error('복구 코드를 확인하지 못했습니다.');
  }

  if (!codeResult.data || !crypto.timingSafeEqual(Buffer.from(codeResult.data.code_hash), Buffer.from(codeHash))) {
    return false;
  }

  const email = await getRecoveryRecipient(userId);
  const nextCode = createRecoveryCode();
  await sendRecoveryCode(email, nextCode);

  const updateResult = await supabaseAdmin
    .from('totp_recovery_codes')
    .update({
      code_hash: getRecoveryCodeHash(userId, nextCode),
      issued_at: new Date().toISOString(),
      used_at: new Date().toISOString(),
      verified_session_id: sessionId,
      verified_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('code_hash', codeHash)
    .select('user_id');

  if (updateResult.error) {
    console.error('[totp-recovery] code rotate error', updateResult.error);
    throw new Error('복구 코드를 갱신하지 못했습니다.');
  }

  return (updateResult.data?.length ?? 0) === 1;
}

export async function hasTotpRecoveryAccess(userId: string, sessionId: string | null) {
  if (!sessionId) return false;

  const result = await getSupabaseAdmin()
    .from('totp_recovery_codes')
    .select('user_id')
    .eq('user_id', userId)
    .eq('verified_session_id', sessionId)
    .maybeSingle();

  if (result.error) {
    console.error('[totp-recovery] session access select error', result.error);
    return false;
  }

  return Boolean(result.data);
}
