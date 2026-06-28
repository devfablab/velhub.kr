import { NextResponse } from 'next/server';
import { createIdentityVerificationId, createPortOneIdentityRequest } from '@/lib/identity/portone';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST() {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims?.userId) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const identityVerificationId = createIdentityVerificationId(sessionClaims.userId);
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin.from('chorogons').upsert(
    {
      user_id: sessionClaims.userId,
      verification_provider: 'portone',
      verification_tx_id: identityVerificationId,
      updated_at: now,
    },
    {
      onConflict: 'user_id',
    },
  );

  if (error) {
    return NextResponse.json({ message: '본인인증 요청 생성에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json(createPortOneIdentityRequest(identityVerificationId));
}
