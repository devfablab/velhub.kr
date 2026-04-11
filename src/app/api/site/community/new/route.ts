import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type VisibilityType = 'public' | 'private';
type ThemeType = 'default';
type JoinType = 'open' | 'invite';
type PolicyPost = 'comment_0' | 'comment_1' | 'comment_3' | 'comment_5';
type PolicyComment = 'estimate_0' | 'estimate_1' | 'estimate_3' | 'estimate_5';

type RequestBody = {
  siteKey: string | null;
  siteLabel: string | null;
  profilePicture: string | null;
  summary: string | null;
  visibilityType: VisibilityType | null;
  themeType: ThemeType | null;
  planType: string | null;
  isShutdown: boolean | null;
  joinType: JoinType | null;
  policyPost: PolicyPost | null;
  policyComment: PolicyComment | null;
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

function isJoinType(value: unknown): value is JoinType {
  return value === 'open' || value === 'invite';
}

function isPolicyPost(value: unknown): value is PolicyPost {
  return value === 'comment_0' || value === 'comment_1' || value === 'comment_3' || value === 'comment_5';
}

function isPolicyComment(value: unknown): value is PolicyComment {
  return value === 'estimate_0' || value === 'estimate_1' || value === 'estimate_3' || value === 'estimate_5';
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
    const joinType = isJoinType(requestBody.joinType) ? requestBody.joinType : 'open';
    const policyPost = isPolicyPost(requestBody.policyPost) ? requestBody.policyPost : 'comment_1';
    const policyComment = isPolicyComment(requestBody.policyComment) ? requestBody.policyComment : 'estimate_0';

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
      return Response.json({ error: '요금제를 선택해주세요.' }, { status: 400 });
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
      .eq('category_key', 'community')
      .maybeSingle();

    if (planResult.error) {
      return Response.json({ error: planResult.error.message || '요금제 확인에 실패했습니다.' }, { status: 500 });
    }

    if (!planResult.data) {
      return Response.json({ error: '유효하지 않은 요금제입니다.' }, { status: 400 });
    }

    const rpcResult = await supabaseAdmin.rpc('create_community_site', {
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
      p_join_type: joinType,
      p_policy_post: policyPost,
      p_policy_comment: policyComment,
    });

    if (rpcResult.error || !rpcResult.data) {
      console.error('create_community_site rpc 실패:', rpcResult.error);
      return Response.json({ error: rpcResult.error?.message || '커뮤니티 생성에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      siteId: rpcResult.data,
      siteKey: normalizedSiteKey,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '커뮤니티 생성에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '커뮤니티 생성에 실패했습니다.' }, { status: 500 });
  }
}
