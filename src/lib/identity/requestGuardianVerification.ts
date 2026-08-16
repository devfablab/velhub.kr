'use client';

import PortOne from '@portone/browser-sdk/v2';

type StartResponse = { storeId?: string; channelKey?: string; identityVerificationId?: string; message?: string };

export async function requestGuardianIdentityVerification() {
  const startResponse = await fetch('/api/identity/portone/guardian', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const start = (await startResponse.json().catch(() => null)) as StartResponse | null;
  if (!startResponse.ok || !start?.storeId || !start.channelKey || !start.identityVerificationId)
    throw new Error(start?.message ?? '법정대리인 본인인증을 시작하지 못했습니다.');
  const result = await PortOne.requestIdentityVerification({
    storeId: start.storeId,
    channelKey: start.channelKey,
    identityVerificationId: start.identityVerificationId,
  });
  const identityVerificationId = result?.identityVerificationId ?? start.identityVerificationId;
  if (result?.code || !identityVerificationId)
    throw new Error(result?.message ?? '법정대리인 본인인증이 완료되지 않았습니다.');
  const verifyResponse = await fetch('/api/identity/portone/guardian', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identityVerificationId }),
  });
  const verified = (await verifyResponse.json().catch(() => null)) as { message?: string } | null;
  if (!verifyResponse.ok) throw new Error(verified?.message ?? '법정대리인 본인인증 결과를 확인하지 못했습니다.');
  return identityVerificationId;
}
