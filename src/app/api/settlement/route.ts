import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/encryption/decrypt';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { serializeSettlementProfile, SettlementProfileRow } from '@/lib/settlement/profile';

export async function GET() {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims?.userId) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const [settlementResult, paymentEmailResult] = await Promise.all([
    supabaseAdmin
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
      .maybeSingle(),
    supabaseAdmin.from('stigmas').select('payment_email').eq('user_id', sessionClaims.userId).maybeSingle(),
  ]);

  if (settlementResult.error || paymentEmailResult.error) {
    return NextResponse.json({ message: '정산 정보 조회에 실패했습니다.' }, { status: 500 });
  }

  const settlementProfile = settlementResult.data as unknown as SettlementProfileRow | null;

  let paymentEmail: string | null = null;

  if (paymentEmailResult.data?.payment_email) {
    try {
      paymentEmail = decrypt(String(paymentEmailResult.data.payment_email));
    } catch {
      return NextResponse.json({ message: '정산 정보 조회에 실패했습니다.' }, { status: 500 });
    }
  }

  return NextResponse.json({
    ...serializeSettlementProfile(settlementProfile),
    paymentEmail,
  });
}
