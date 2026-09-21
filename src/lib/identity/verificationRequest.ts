import { getSupabaseAdmin } from '@/lib/supabase';

const IDENTITY_VERIFICATION_REQUEST_TTL_MS = 1000 * 60 * 10;

export async function createIdentityVerificationRequest(identityVerificationId: string, authUserId: string) {
  const expiresAt = new Date(Date.now() + IDENTITY_VERIFICATION_REQUEST_TTL_MS).toISOString();
  const result = await getSupabaseAdmin().from('identity_verification_requests').insert({
    identity_verification_id: identityVerificationId,
    auth_user_id: authUserId,
    expires_at: expiresAt,
  });

  if (result.error) {
    throw new Error('본인인증 요청 정보를 저장하지 못했습니다.');
  }
}

export async function assertActiveIdentityVerificationRequest(identityVerificationId: string, authUserId: string) {
  const result = await getSupabaseAdmin()
    .from('identity_verification_requests')
    .select('identity_verification_id, expires_at, used_at')
    .eq('identity_verification_id', identityVerificationId)
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (
    result.error ||
    !result.data ||
    result.data.used_at ||
    new Date(String(result.data.expires_at)).getTime() < Date.now()
  ) {
    throw new Error('유효한 본인인증 요청을 확인하지 못했습니다. 다시 인증해 주세요.');
  }
}

export async function consumeIdentityVerificationRequest(identityVerificationId: string, authUserId: string) {
  const result = await getSupabaseAdmin()
    .from('identity_verification_requests')
    .update({ used_at: new Date().toISOString() })
    .eq('identity_verification_id', identityVerificationId)
    .eq('auth_user_id', authUserId)
    .is('used_at', null)
    .select('identity_verification_id')
    .maybeSingle();

  if (result.error || !result.data) {
    throw new Error('이미 사용된 본인인증 요청입니다. 다시 인증해 주세요.');
  }
}
