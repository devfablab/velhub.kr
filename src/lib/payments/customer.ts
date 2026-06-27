import crypto from 'crypto';
import { decrypt } from '@/lib/encryption/decrypt';
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
    throw new Error('사용자 이메일을 확인하지 못했습니다.');
  }

  const customerName = normalizeText(decrypt(stigmaResult.data.payment_email)).slice(0, 64);

  if (!customerName) {
    throw new Error('사용자 이메일을 확인하지 못했습니다.');
  }

  return customerName;
}

export function createCustomerKey(authUserId: string) {
  const customerKeyHash = crypto.createHash('sha256').update(authUserId).digest('hex');
  return `user_${customerKeyHash}`;
}
