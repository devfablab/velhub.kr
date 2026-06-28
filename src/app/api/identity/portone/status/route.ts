import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/encryption/decrypt';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims?.userId) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from('chorogons')
    .select('name, birth_date, gender, identity_verified_at')
    .eq('user_id', sessionClaims.userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: '본인인증 상태 조회에 실패했습니다.' }, { status: 500 });
  }

  if (!data?.identity_verified_at || !data.name || !data.birth_date || !data.gender) {
    return NextResponse.json({
      exists: false,
      identity: null,
    });
  }

  return NextResponse.json({
    exists: true,
    identity: {
      name: decrypt(String(data.name)),
      birth_date: decrypt(String(data.birth_date)),
      gender: decrypt(String(data.gender)),
      identity_verified_at: data.identity_verified_at,
    },
  });
}
