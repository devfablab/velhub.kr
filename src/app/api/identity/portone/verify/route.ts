import { NextRequest, NextResponse } from 'next/server';
import { extractVerifiedIdentity, getPortOneIdentityVerification } from '@/lib/identity/portone';
import { getSessionClaims } from '@/lib/session';

type SuccessRequestBody = {
  identityVerificationId?: string;
};

function isValidIdentityVerificationId(identityVerificationId: string, userId: string) {
  return identityVerificationId.startsWith(`identity-${userId}-`);
}

export async function POST(request: NextRequest) {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims?.userId) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as SuccessRequestBody | null;
  const identityVerificationId = body?.identityVerificationId;

  if (!identityVerificationId) {
    return NextResponse.json({ message: '본인인증 요청 정보가 없습니다.' }, { status: 400 });
  }

  if (!isValidIdentityVerificationId(identityVerificationId, sessionClaims.userId)) {
    return NextResponse.json({ message: '본인인증 요청 정보가 일치하지 않습니다.' }, { status: 400 });
  }

  const portOneVerification = await getPortOneIdentityVerification(identityVerificationId);

  const verifiedIdentity = extractVerifiedIdentity(identityVerificationId, portOneVerification);

  if (!verifiedIdentity) {
    return NextResponse.json({ message: '본인인증 결과를 확인할 수 없습니다.' }, { status: 400 });
  }

  return NextResponse.json({
    name: verifiedIdentity.name,
    birth_date: verifiedIdentity.birthDate,
    gender: verifiedIdentity.gender,
  });
}
