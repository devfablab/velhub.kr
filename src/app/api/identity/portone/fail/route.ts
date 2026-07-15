import { NextRequest, NextResponse } from 'next/server';
import { getSessionClaims } from '@/lib/session';

type FailRequestBody = {
  identityVerificationId?: string;
  code?: string;
  message?: string;
};

function isValidIdentityVerificationId(identityVerificationId: string, userId: string) {
  return identityVerificationId.startsWith(`identity-${userId}-`);
}

export async function POST(request: NextRequest) {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims?.userId) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as FailRequestBody | null;
  const identityVerificationId = body?.identityVerificationId;

  if (identityVerificationId && !isValidIdentityVerificationId(identityVerificationId, sessionClaims.userId)) {
    return NextResponse.json({ message: '본인인증 요청 정보가 일치하지 않습니다.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
