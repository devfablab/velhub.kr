import { getSupabaseAdmin } from '@/lib/supabase';

type SocialCheckRequestBody = {
  email: string;
};

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as SocialCheckRequestBody;

    const email = requestBody.email.trim().toLowerCase();

    const supabaseAdmin = getSupabaseAdmin();

    const particlesResult = await supabaseAdmin.from('particles').select('social').eq('email', email).maybeSingle();

    if (particlesResult.error) {
      return Response.json({ error: '계정 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!particlesResult.data) {
      return Response.json({
        needsConfirm: false,
      });
    }

    if (particlesResult.data.social === false) {
      return Response.json({
        needsConfirm: true,
        message: '이미 이메일로 가입한 계정입니다. 그래도 소셜 로그인으로 로그인하시겠습니까?',
      });
    }

    return Response.json({
      needsConfirm: false,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '계정 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '계정 정보를 확인하지 못했습니다.' }, { status: 500 });
  }
}
