import { getSupabaseAdmin } from '@/lib/supabase';
import { getSessionClaims } from '@/lib/session';

type AuthIdentity = {
  provider?: string;
};

type RequestBody = {
  defaultLoginMethod: 'email' | 'social';
};

function hasEmailIdentity(identities: AuthIdentity[] | undefined) {
  return Boolean(identities?.some((identity) => identity.provider === 'email'));
}

function hasSocialIdentity(identities: AuthIdentity[] | undefined) {
  return Boolean(identities?.some((identity) => identity.provider && identity.provider !== 'email'));
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
      .select('social, email')
      .eq('id', sessionClaims.userId)
      .maybeSingle();

    if (particlesResult.error || !particlesResult.data) {
      return Response.json({ error: '기본 로그인 방식을 확인하지 못했습니다.' }, { status: 500 });
    }

    const authUserResult = await supabaseAdmin.auth.admin.getUserById(sessionClaims.userId);

    if (authUserResult.error || !authUserResult.data.user) {
      return Response.json({ error: '계정 인증 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const identities = (authUserResult.data.user.identities ?? []) as AuthIdentity[];
    const canChangeDefaultLoginMethod = hasEmailIdentity(identities) && hasSocialIdentity(identities);

    return Response.json({
      email: particlesResult.data.email,
      defaultLoginMethod: particlesResult.data.social ? 'social' : 'email',
      canChangeDefaultLoginMethod,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '기본 로그인 방식을 확인하지 못했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '기본 로그인 방식을 확인하지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestBody = (await request.json()) as RequestBody;

    if (requestBody.defaultLoginMethod !== 'email' && requestBody.defaultLoginMethod !== 'social') {
      return Response.json({ error: '기본 로그인 방식이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const authUserResult = await supabaseAdmin.auth.admin.getUserById(sessionClaims.userId);

    if (authUserResult.error || !authUserResult.data.user) {
      return Response.json({ error: '계정 인증 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const identities = (authUserResult.data.user.identities ?? []) as AuthIdentity[];
    const canChangeDefaultLoginMethod = hasEmailIdentity(identities) && hasSocialIdentity(identities);

    if (!canChangeDefaultLoginMethod) {
      return Response.json({ error: '기본 로그인 방식을 변경할 수 없는 계정입니다.' }, { status: 400 });
    }

    const updateResult = await supabaseAdmin
      .from('particles')
      .update({
        social: requestBody.defaultLoginMethod === 'social',
      })
      .eq('id', sessionClaims.userId);

    if (updateResult.error) {
      return Response.json({ error: '기본 로그인 방식 변경에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      defaultLoginMethod: requestBody.defaultLoginMethod,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '기본 로그인 방식 변경에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '기본 로그인 방식 변경에 실패했습니다.' }, { status: 500 });
  }
}
