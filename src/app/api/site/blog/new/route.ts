import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type VisibilityType = 'public' | 'private';
type ThemeType = 'default';
type CommentProvider = 'none' | 'giscus' | 'disqus';

type RequestBody = {
  siteKey: string | null;
  siteLabel: string | null;
  profilePicture: string | null;
  summary: string | null;
  visibilityType: VisibilityType | null;
  themeType: ThemeType | null;
  planType: string | null;
  isShutdown: boolean | null;
  commentProvider: CommentProvider | null;
};

function normalizeSiteKey(rawValue: string) {
  return rawValue
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
}

function hasInvalidCharacters(value: string) {
  return /[^a-z0-9-]/.test(value);
}

function isVisibilityType(value: unknown): value is VisibilityType {
  return value === 'public' || value === 'private';
}

function isThemeType(value: unknown): value is ThemeType {
  return value === 'default';
}

function isCommentProvider(value: unknown): value is CommentProvider {
  return value === 'none' || value === 'giscus' || value === 'disqus';
}

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestBody = (await request.json()) as RequestBody;

    const normalizedSiteKey = normalizeSiteKey(requestBody.siteKey?.trim() ?? '');
    const trimmedSiteLabel = requestBody.siteLabel?.trim() ?? '';
    const trimmedProfilePicture = requestBody.profilePicture?.trim() ?? '';
    const trimmedSummary = requestBody.summary?.trim() ?? '';
    const trimmedPlanType = requestBody.planType?.trim() ?? '';

    const visibilityType = isVisibilityType(requestBody.visibilityType) ? requestBody.visibilityType : 'public';
    const themeType = isThemeType(requestBody.themeType) ? requestBody.themeType : 'default';
    const isShutdown = typeof requestBody.isShutdown === 'boolean' ? requestBody.isShutdown : false;
    const commentProvider = isCommentProvider(requestBody.commentProvider) ? requestBody.commentProvider : 'disqus';

    if (!normalizedSiteKey) {
      return Response.json({ error: '사이트 식별자를 입력해주세요.' }, { status: 400 });
    }

    if (hasInvalidCharacters(normalizedSiteKey)) {
      return Response.json({ error: "영소문자, 하이픈('-'), 숫자만 사용 가능합니다." }, { status: 400 });
    }

    if (/^\d/.test(normalizedSiteKey)) {
      return Response.json({ error: '사이트 식별자는 숫자로 시작할 수 없습니다.' }, { status: 400 });
    }

    if (normalizedSiteKey.length < 5 || normalizedSiteKey.length > 15) {
      return Response.json({ error: '사이트 식별자는 5자 이상 15자 이하여야 합니다.' }, { status: 400 });
    }

    if (normalizedSiteKey.includes('--')) {
      return Response.json({ error: "영소문자, 하이픈('-'), 숫자만 사용 가능합니다." }, { status: 400 });
    }

    if (!trimmedPlanType) {
      return Response.json({ error: '플랜을 선택해주세요.' }, { status: 400 });
    }

    const finalSiteLabel = trimmedSiteLabel || normalizedSiteKey;

    const supabaseAdmin = getSupabaseAdmin();

    const particlesResult = await supabaseAdmin
      .from('particles')
      .select('id')
      .eq('id', sessionClaims.userId)
      .maybeSingle();

    if (particlesResult.error || !particlesResult.data) {
      return Response.json({ error: '사용자 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error || !stigmaResult.data) {
      return Response.json({ error: '사용자 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const denylistResult = await supabaseAdmin
      .from('denylist')
      .select('word')
      .eq('word', normalizedSiteKey)
      .maybeSingle();

    if (denylistResult.error) {
      return Response.json({ error: '사이트 식별자 확인에 실패했습니다.' }, { status: 500 });
    }

    if (denylistResult.data) {
      return Response.json({ error: '사용할 수 없는 사이트 식별자입니다.' }, { status: 400 });
    }

    const rhizomeResult = await supabaseAdmin
      .from('rhizomes')
      .select('id')
      .eq('site_key', normalizedSiteKey)
      .maybeSingle();

    if (rhizomeResult.error) {
      return Response.json({ error: '사이트 식별자 확인에 실패했습니다.' }, { status: 500 });
    }

    if (rhizomeResult.data) {
      return Response.json({ error: '사용할 수 없는 사이트 식별자입니다.' }, { status: 400 });
    }

    const planResult = await supabaseAdmin
      .from('plans')
      .select('id')
      .eq('id', trimmedPlanType)
      .eq('category_key', 'blog')
      .maybeSingle();

    if (planResult.error) {
      return Response.json({ error: planResult.error.message || '플랜 확인에 실패했습니다.' }, { status: 500 });
    }

    if (!planResult.data) {
      return Response.json({ error: '유효하지 않은 플랜입니다.' }, { status: 400 });
    }

    const rpcResult = await supabaseAdmin.rpc('create_blog_site', {
      p_owner_particle_id: particlesResult.data.id,
      p_owner_stigma_id: stigmaResult.data.id,
      p_site_key: normalizedSiteKey,
      p_site_label: finalSiteLabel,
      p_profile_picture: trimmedProfilePicture,
      p_summary: trimmedSummary,
      p_visibility_type: visibilityType,
      p_theme_type: themeType,
      p_plan_type: trimmedPlanType,
      p_is_shutdown: isShutdown,
      p_comment_provider: commentProvider,
    });

    if (rpcResult.error || !rpcResult.data) {
      console.error('create_blog_site rpc 실패:', rpcResult.error);
      return Response.json({ error: rpcResult.error?.message || '블로그 생성에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      siteId: rpcResult.data,
      siteKey: normalizedSiteKey,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '블로그 생성에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '블로그 생성에 실패했습니다.' }, { status: 500 });
  }
}
