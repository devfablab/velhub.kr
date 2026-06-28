import { NextRequest, NextResponse } from 'next/server';
import { createSettlementProfileUpdatePayload, validateSettlementProfileInput } from '@/lib/settlement/profile';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims?.userId) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const validatedInput = validateSettlementProfileInput(body);

  if (!validatedInput.ok) {
    return NextResponse.json({ message: validatedInput.message }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: existingRow, error: existingError } = await supabaseAdmin
    .from('chorogons')
    .select('identity_verified_at, settlement_type')
    .eq('user_id', sessionClaims.userId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ message: '정산 정보 확인에 실패했습니다.' }, { status: 500 });
  }

  if (!existingRow?.identity_verified_at) {
    return NextResponse.json({ message: '본인인증이 필요합니다.' }, { status: 403 });
  }

  if (existingRow.settlement_type) {
    return NextResponse.json({ message: '이미 등록된 정산 정보가 있습니다.' }, { status: 409 });
  }

  const { error } = await supabaseAdmin
    .from('chorogons')
    .update(createSettlementProfileUpdatePayload(validatedInput.data))
    .eq('user_id', sessionClaims.userId);

  if (error) {
    return NextResponse.json({ message: '정산 정보 등록에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
