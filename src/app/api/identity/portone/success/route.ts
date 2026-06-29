import { NextRequest, NextResponse } from 'next/server';
import { extractVerifiedIdentity, getPortOneIdentityVerification } from '@/lib/identity/portone';
import { encrypt } from '@/lib/encryption/encrypt';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

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
  console.log('portOneVerification: ', JSON.stringify(portOneVerification, null, 2));

  const verifiedIdentity = extractVerifiedIdentity(identityVerificationId, portOneVerification);

  console.log('verifiedIdentity: ', verifiedIdentity);

  if (!verifiedIdentity) {
    return NextResponse.json({ message: '본인인증 결과를 확인할 수 없습니다.' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: existingRow, error: findError } = await supabaseAdmin
    .from('chorogons')
    .select('user_id')
    .eq('user_id', sessionClaims.userId)
    .maybeSingle();

  if (findError) {
    console.log('error: ', findError);

    return NextResponse.json({ message: '본인인증 정보 확인에 실패했습니다.' }, { status: 500 });
  }

  const payload = {
    provider: 'inicis',
    verification_tx_id: identityVerificationId,
    name: encrypt(verifiedIdentity.name),
    birth_date: encrypt(verifiedIdentity.birthDate),
    gender: encrypt(verifiedIdentity.gender),
    identity_verified_at: now,
    updated_at: now,
  };

  if (existingRow) {
    const { error } = await supabaseAdmin.from('chorogons').update(payload).eq('user_id', sessionClaims.userId);

    if (error) {
      console.log('error: ', error);

      return NextResponse.json({ message: '본인인증 정보 저장에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json(verifiedIdentity);
  }

  const { error } = await supabaseAdmin.from('chorogons').insert({
    user_id: sessionClaims.userId,
    ...payload,
  });

  if (error) {
    console.log('error: ', error);

    return NextResponse.json({ message: '본인인증 정보 저장에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({
    name: verifiedIdentity.name,
    birth_date: verifiedIdentity.birthDate,
    gender: verifiedIdentity.gender,
  });
}
