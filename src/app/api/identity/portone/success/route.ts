import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/encryption/encrypt';
import { extractVerifiedIdentity, getPortOneIdentityVerification } from '@/lib/identity/portone';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type RequestBody = {
  identityVerificationId?: string;
};

export async function POST(request: NextRequest) {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims?.userId) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as RequestBody | null;
  const identityVerificationId = body?.identityVerificationId?.trim();

  if (!identityVerificationId) {
    return NextResponse.json({ message: '본인인증 ID가 없습니다.' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: existingRow, error: existingError } = await supabaseAdmin
    .from('chorogons')
    .select('verification_tx_id')
    .eq('user_id', sessionClaims.userId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ message: '본인인증 상태 확인에 실패했습니다.' }, { status: 500 });
  }

  if (existingRow?.verification_tx_id !== identityVerificationId) {
    return NextResponse.json({ message: '본인인증 요청 정보가 일치하지 않습니다.' }, { status: 400 });
  }

  const portOneResult = await getPortOneIdentityVerification(identityVerificationId);

  if (!portOneResult.ok) {
    return NextResponse.json({ message: '포트원 본인인증 조회에 실패했습니다.' }, { status: 502 });
  }

  const verifiedIdentity = extractVerifiedIdentity(identityVerificationId, portOneResult.data);

  if (!verifiedIdentity) {
    return NextResponse.json({ message: '본인인증이 완료되지 않았습니다.' }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { error } = await supabaseAdmin.from('chorogons').upsert(
    {
      user_id: sessionClaims.userId,
      verification_provider: 'portone',
      verification_tx_id: verifiedIdentity.identityVerificationId,
      name: encrypt(verifiedIdentity.name),
      birth_date: encrypt(verifiedIdentity.birthDate),
      gender: encrypt(verifiedIdentity.gender),
      identity_verified_at: now,
      updated_at: now,
    },
    {
      onConflict: 'user_id',
    },
  );

  if (error) {
    return NextResponse.json({ message: '본인인증 결과 저장에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({
    name: verifiedIdentity.name,
    birth_date: verifiedIdentity.birthDate,
    gender: verifiedIdentity.gender,
  });
}
