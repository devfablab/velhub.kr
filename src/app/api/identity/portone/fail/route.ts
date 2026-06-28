import { NextRequest, NextResponse } from 'next/server';
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
    return NextResponse.json({ ok: true });
  }

  const supabaseAdmin = getSupabaseAdmin();

  await supabaseAdmin
    .from('chorogons')
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', sessionClaims.userId)
    .eq('verification_tx_id', identityVerificationId);

  return NextResponse.json({ ok: true });
}
