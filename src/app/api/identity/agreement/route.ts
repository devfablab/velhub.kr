import { NextRequest, NextResponse } from 'next/server';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type AgreementRequestBody = {
  type?: 'identity' | 'settlement';
};

export async function POST(request: NextRequest) {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims?.userId) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as AgreementRequestBody | null;

  if (body?.type !== 'identity' && body?.type !== 'settlement') {
    return NextResponse.json({ message: '동의 종류를 확인하지 못했습니다.' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const agreementField = body.type === 'identity' ? 'is_agree_identity' : 'is_agree_settlement';
  const { error } = await supabaseAdmin
    .from('stigmas')
    .update({ [agreementField]: true })
    .eq('user_id', sessionClaims.userId);

  if (error) {
    return NextResponse.json({ message: '동의 정보를 저장하지 못했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
