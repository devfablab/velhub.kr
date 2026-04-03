import { getSupabaseAdmin } from '@/lib/supabase';
import { getSessionClaims } from '@/lib/session';

type AuthIdentity = {
  provider?: string;
};

function hasEmailIdentity(identities: AuthIdentity[] | undefined) {
  return Boolean(identities?.some((identity) => identity.provider === 'email'));
}

export async function GET() {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const particlesResult = await supabaseAdmin
      .from('particles')
      .select('social')
      .eq('id', sessionClaims.userId)
      .maybeSingle();

    if (particlesResult.error || !particlesResult.data) {
      return Response.json({ error: '비밀번호 상태를 확인하지 못했습니다.' }, { status: 500 });
    }

    const authUserResult = await supabaseAdmin.auth.admin.getUserById(sessionClaims.userId);

    if (authUserResult.error || !authUserResult.data.user) {
      return Response.json({ error: '비밀번호 상태를 확인하지 못했습니다.' }, { status: 500 });
    }

    const identities = (authUserResult.data.user.identities ?? []) as AuthIdentity[];

    return Response.json({
      isSocialAccount: particlesResult.data.social === true,
      hasPassword: hasEmailIdentity(identities),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '비밀번호 상태를 확인하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '비밀번호 상태를 확인하지 못했습니다.' }, { status: 500 });
  }
}
