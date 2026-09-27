import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type SocialCheckRequestBody = {
  authUserId: string;
};

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as SocialCheckRequestBody;

    const authUserId = requestBody.authUserId.trim();
    const sessionClaims = await getSessionClaims();

    if (!authUserId || sessionClaims?.userId !== authUserId) {
      return Response.json({ error: '로그인 정보를 확인하지 못했습니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const authUserResult = await supabaseAdmin.auth.admin.getUserById(authUserId);

    if (authUserResult.error || !authUserResult.data.user?.email) {
      return Response.json({ error: '소셜 로그인 정보를 확인하지 못했습니다.' }, { status: 401 });
    }

    const email = authUserResult.data.user.email.trim().toLowerCase();

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('is_agree_term, is_agree_child, is_agree_privacy')
      .eq('user_id', authUserId)
      .maybeSingle();

    if (stigmaResult.error) {
      return Response.json({ error: '계정 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (
      !stigmaResult.data ||
      stigmaResult.data.is_agree_term !== true ||
      stigmaResult.data.is_agree_child !== true ||
      stigmaResult.data.is_agree_privacy !== true
    ) {
      return Response.json({ needsSignup: true, needsConfirm: false });
    }

    const particlesResult = await supabaseAdmin.from('particles').select('social').eq('email', email).maybeSingle();

    if (particlesResult.error) {
      return Response.json({ error: '계정 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!particlesResult.data) {
      return Response.json({ needsSignup: false, needsConfirm: false });
    }

    if (particlesResult.data.social === false) {
      return Response.json({
        needsSignup: false,
        needsConfirm: true,
        message: '소셜 로그인 인증이 완료되었습니다. 기존 계정에 이 소셜 로그인을 연결하시겠습니까?',
      });
    }

    return Response.json({ needsSignup: false, needsConfirm: false });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '계정 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '계정 정보를 확인하지 못했습니다.' }, { status: 500 });
  }
}
