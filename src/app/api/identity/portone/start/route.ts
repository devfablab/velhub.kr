import { NextResponse } from 'next/server';
import { createIdentityVerificationId, createPortOneIdentityRequest } from '@/lib/identity/portone';
import { getSessionClaims } from '@/lib/session';

export async function POST() {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims?.userId) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const identityVerificationId = createIdentityVerificationId(sessionClaims.userId);

  return NextResponse.json(createPortOneIdentityRequest(identityVerificationId));
}
