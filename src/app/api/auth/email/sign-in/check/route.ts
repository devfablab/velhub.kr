import { getSupabaseAdmin } from '@/lib/supabase';

type CheckRequestBody = {
  email: string | null;
};

type AuthIdentity = {
  provider?: string;
};

function hasEmailIdentity(identities: AuthIdentity[] | undefined) {
  return Boolean(identities?.some((identity) => identity.provider === 'email'));
}

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as CheckRequestBody;

    const email = requestBody.email?.trim().toLowerCase() ?? '';

    if (!email) {
      return Response.json({ error: '이메일을 입력해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const particlesResult = await supabaseAdmin.from('particles').select('id, social').eq('email', email).maybeSingle();

    if (particlesResult.error) {
      return Response.json({ error: '계정 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!particlesResult.data) {
      return Response.json({
        accountType: 'none',
        hasPassword: false,
      });
    }

    if (particlesResult.data.social !== true) {
      return Response.json({
        accountType: 'email',
        hasPassword: true,
      });
    }

    const authUserResult = await supabaseAdmin.auth.admin.getUserById(particlesResult.data.id);

    if (authUserResult.error) {
      return Response.json({ error: '계정 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const hasPassword = hasEmailIdentity((authUserResult.data.user.identities ?? []) as AuthIdentity[]);

    return Response.json({
      accountType: 'social',
      hasPassword,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '계정 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '계정 정보를 확인하지 못했습니다.' }, { status: 500 });
  }
}
