import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims?.userId) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const [particleResult, stigmaResult, authUserResult] = await Promise.all([
    supabaseAdmin.from('particles').select('social').eq('id', sessionClaims.userId).maybeSingle(),
    supabaseAdmin
      .from('stigmas')
      .select('is_agree_term, is_agree_child, is_agree_privacy')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(sessionClaims.userId),
  ]);

  if (particleResult.error || stigmaResult.error || authUserResult.error) {
    return Response.json({ error: '회원가입 상태를 확인하지 못했습니다.' }, { status: 500 });
  }

  const authUser = authUserResult.data.user;
  const provider = String(authUser?.app_metadata?.provider ?? authUser?.user_metadata?.provider ?? '').toLowerCase();
  const isSocial = particleResult.data?.social === true || (provider !== '' && provider !== 'email');
  const needsSocialSignUp =
    isSocial &&
    (!stigmaResult.data ||
      stigmaResult.data.is_agree_term !== true ||
      stigmaResult.data.is_agree_child !== true ||
      stigmaResult.data.is_agree_privacy !== true);

  return Response.json({ ok: true, needsSocialSignUp });
}
