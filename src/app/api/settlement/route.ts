import { NextResponse } from 'next/server';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { serializeSettlementProfile, SettlementProfileRow } from '@/lib/settlement/profile';

export async function GET() {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims?.userId) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from('chorogons')
    .select(
      [
        'name',
        'birth_date',
        'gender',
        'identity_verified_at',
        'settlement_type',
        'resident_registration_number',
        'business_registration_number',
        'business_license',
        'business_income_code',
        'bank_code',
        'account_number',
        'account_holder',
        'account_verified_at',
        'company_name',
      ].join(', '),
    )
    .eq('user_id', sessionClaims.userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: '정산 정보 조회에 실패했습니다.' }, { status: 500 });
  }

  const settlementProfile = data as unknown as SettlementProfileRow | null;

  return NextResponse.json(serializeSettlementProfile(settlementProfile));
}
