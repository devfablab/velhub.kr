import { decrypt } from '@/lib/encryption/decrypt';
import { extractVerifiedIdentity, getPortOneIdentityVerification } from '@/lib/identity/portone';
import { getSupabaseAdmin } from '@/lib/supabase';

export type MinorPaymentControlResult = { guardianIdentityVerificationId: string | null; error: string | null };

export async function enforceMinorPaymentControl(
  stigmaId: string,
  identityVerificationId?: string | null,
): Promise<MinorPaymentControlResult> {
  const db = getSupabaseAdmin();
  const { data: identity, error } = await db
    .from('chorogons')
    .select('id, father_name, father_birth_date, mother_name, mother_birth_date')
    .eq('user_id', stigmaId)
    .maybeSingle();
  if (error || !identity) return { guardianIdentityVerificationId: null, error: null };
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const { data: control } = await db
    .from('payment_minor_controls')
    .select('mode, effective_until')
    .eq('chorogon_id', identity.id)
    .gte('effective_until', today)
    .maybeSingle();
  if (!control) return { guardianIdentityVerificationId: null, error: null };
  if (control.mode === 'blocked_until_adult')
    return {
      guardianIdentityVerificationId: null,
      error: '이 계정은 만 19세가 될 때까지 결제 · 구매 · 후원을 이용할 수 없습니다.',
    };
  if (!identityVerificationId)
    return { guardianIdentityVerificationId: null, error: '결제를 진행하려면 법정대리인 본인인증이 필요합니다.' };
  const verification = await getPortOneIdentityVerification(identityVerificationId);
  const verified = extractVerifiedIdentity(identityVerificationId, verification);
  if (!verified)
    return { guardianIdentityVerificationId: null, error: '법정대리인 본인인증 결과를 확인할 수 없습니다.' };
  const decode = (value: string | null) => {
    if (!value) return '';
    try {
      return decrypt(value);
    } catch {
      return value;
    }
  };
  const matchesFather =
    verified.name === decode(identity.father_name) &&
    verified.birthDate.replace(/\D/g, '') === decode(identity.father_birth_date).replace(/\D/g, '');
  const matchesMother =
    verified.name === decode(identity.mother_name) &&
    verified.birthDate.replace(/\D/g, '') === decode(identity.mother_birth_date).replace(/\D/g, '');
  if (!matchesFather && !matchesMother)
    return {
      guardianIdentityVerificationId: null,
      error: '본인인증 정보가 법정대리인의 정보와 다릅니다',
    };
  return { guardianIdentityVerificationId: identityVerificationId, error: null };
}
