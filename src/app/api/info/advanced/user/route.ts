import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type ProfileRow = {
  auto_login: boolean | null;
};

export async function GET() {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims?.userId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const profileResult = await supabaseAdmin
      .from('profiles')
      .select('auto_login')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (profileResult.error) {
      return Response.json({ error: '추가 설정 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const profile = (profileResult.data ?? null) as ProfileRow | null;

    return Response.json({
      profile: {
        auto_login: typeof profile?.auto_login === 'boolean' ? profile.auto_login : true,
      },
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '추가 설정 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '추가 설정 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
