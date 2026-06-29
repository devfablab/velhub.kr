import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/encryption/decrypt';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims?.userId) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const requestUrl = new URL(request.url);
  const targetUserId = normalizeText(requestUrl.searchParams.get('userId')) || sessionClaims.userId;

  const { data, error } = await supabaseAdmin
    .from('chorogons')
    .select('name, birth_date, birth_date_dummy, gender, identity_verified_at')
    .eq('user_id', targetUserId)
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

  const birthDate =
    process.env.NEXT_PUBLIC_APP_ENV === 'test' && data.birth_date_dummy
      ? data.birth_date_dummy
      : decrypt(String(data.birth_date));

  return NextResponse.json({
    exists: true,
    identity: {
      name: decrypt(String(data.name)),
      birth_date: birthDate,
      gender: decrypt(String(data.gender)),
      identity_verified_at: data.identity_verified_at,
    },
  });
}
