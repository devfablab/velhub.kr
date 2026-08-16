import { NextRequest, NextResponse } from 'next/server';
import {
  createIdentityVerificationId,
  createPortOneIdentityRequest,
  extractVerifiedIdentity,
  getPortOneIdentityVerification,
} from '@/lib/identity/portone';
import { getSessionClaims } from '@/lib/session';

type GuardianVerifyBody = {
  identityVerificationId?: string;
};

function isAdult(birthDate: string) {
  const digits = birthDate.replace(/\D/g, '');
  if (digits.length !== 8) return false;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const today = new Date();
  const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
  let age = today.getFullYear() - year;
  if (today < birthdayThisYear) age -= 1;
  return age >= 19;
}

export async function POST(request: NextRequest) {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims?.userId) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as GuardianVerifyBody | null;
  const identityVerificationId = body?.identityVerificationId;

  if (!identityVerificationId) {
    const newId = createIdentityVerificationId('guardian-' + sessionClaims.userId);
    return NextResponse.json(createPortOneIdentityRequest(newId));
  }

  const portOneVerification = await getPortOneIdentityVerification(identityVerificationId);
  const verifiedIdentity = extractVerifiedIdentity(identityVerificationId, portOneVerification);

  if (!verifiedIdentity) {
    return NextResponse.json({ message: '법정대리인 본인인증 결과를 확인할 수 없습니다.' }, { status: 400 });
  }

  if (!isAdult(verifiedIdentity.birthDate)) {
    return NextResponse.json({ message: '법정대리인은 만 19세 이상 성인이어야 합니다.' }, { status: 400 });
  }

  return NextResponse.json({
    identityVerificationId,
    name: verifiedIdentity.name,
    birth_date: verifiedIdentity.birthDate,
    gender: verifiedIdentity.gender,
  });
}
