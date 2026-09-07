import crypto from 'crypto';
import { decrypt } from '@/lib/encryption/decrypt';
import { extractVerifiedIdentity, getPortOneIdentityVerification } from '@/lib/identity/portone';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

export async function getPaymentCustomerName(authUserId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('payment_email')
    .eq('user_id', authUserId)
    .maybeSingle();

  if (stigmaResult.error) {
    console.error(stigmaResult.error);
    throw new Error('사용자 정보를 확인하지 못했습니다.');
  }

  if (!stigmaResult.data?.payment_email) {
    return null;
  }

  const customerName = normalizeText(decrypt(stigmaResult.data.payment_email)).slice(0, 64);

  if (!customerName) {
    return null;
  }

  return customerName;
}

export async function getPaymentCustomerPhone(authUserId: string) {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'test') {
    return '01000000000';
  }

  const supabaseAdmin = getSupabaseAdmin();
  const identityResult = await supabaseAdmin
    .from('chorogons')
    .select('verification_tx_id')
    .eq('user_id', authUserId)
    .maybeSingle();

  if (identityResult.error) {
    console.error(identityResult.error);
    throw new Error('본인인증 정보를 확인하지 못했습니다.');
  }

  const identityVerificationId = normalizeText(identityResult.data?.verification_tx_id);
  if (!identityVerificationId) {
    return null;
  }

  const identityVerification = await getPortOneIdentityVerification(identityVerificationId);
  if (!identityVerification.ok) {
    return null;
  }

  return extractVerifiedIdentity(identityVerificationId, identityVerification.data)?.phoneNumber ?? null;
}

export function createCustomerKey(authUserId: string) {
  const customerKeyHash = crypto.createHash('sha256').update(authUserId).digest('hex');
  return `user_${customerKeyHash}`;
}
