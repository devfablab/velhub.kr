import { isAtLeast14 } from '@/lib/identity/age';
import { getChorogonBirthDate } from '@/lib/identity/chorogon';
import { hasValidBlogSubscription } from '@/lib/payments/blogDonation';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

export type BlogCommunityContext = {
  siteId: string;
  siteName: string;
  ownerId: string;
  createdAt: string;
  isPersonalBlog: boolean;
  hasBeenOpenFor15Days: boolean;
  seriesPostCount: number;
  isEligible: boolean;
  hasStarted: boolean;
  isEnabled: boolean;
  isOwner: boolean;
  isSubscriber: boolean;
  stigmaId: string | null;
  canUse: boolean;
};

function hasBeenOpenForFifteenDays(createdAt: string) {
  const created = new Date(createdAt).getTime();
  return Number.isFinite(created) && created + 15 * 24 * 60 * 60 * 1000 <= Date.now();
}

export async function getBlogCommunityContext(siteName: string): Promise<BlogCommunityContext | null> {
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  if (!normalizedSiteName) return null;

  const supabaseAdmin = getSupabaseAdmin();
  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_type, owner_id, created_at')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (siteResult.error) throw new Error('블로그 정보를 불러오지 못했습니다.');
  if (!siteResult.data || siteResult.data.site_type !== 'blog') return null;

  const [blogResult, communityResult, seriesPostCountResult, session] = await Promise.all([
    supabaseAdmin.from('blogs').select('blog_type').eq('site_id', siteResult.data.id).maybeSingle(),
    supabaseAdmin.from('blog_communities').select('is_enabled').eq('site_id', siteResult.data.id).maybeSingle(),
    supabaseAdmin
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteResult.data.id)
      .eq('published_status', 'published')
      .eq('is_closed', false)
      .not('series_id', 'is', null),
    verifySession({ siteId: siteResult.data.id }),
  ]);

  if (blogResult.error || communityResult.error || seriesPostCountResult.error) {
    throw new Error('블로그 커뮤니티 정보를 불러오지 못했습니다.');
  }

  // 기존 개인 블로그는 blog_type이 null일 수 있으며, team으로 명시된 경우만 팀 블로그입니다.
  const isPersonalBlog = blogResult.data?.blog_type !== 'team';
  const isOwner = session.case === 'admin' || session.stigmaId === siteResult.data.owner_id;
  const isSubscriber =
    !isOwner && session.stigmaId
      ? await hasValidBlogSubscription({
          supabaseAdmin,
          subscriberId: session.stigmaId,
          siteId: siteResult.data.id,
        })
      : false;
  const hasBeenOpenFor15Days = hasBeenOpenForFifteenDays(String(siteResult.data.created_at));
  const seriesPostCount = seriesPostCountResult.count ?? 0;
  const isEligible = hasBeenOpenFor15Days && seriesPostCount >= 5;
  const isEnabled = communityResult.data?.is_enabled === true;
  const hasStarted = Boolean(communityResult.data);

  return {
    siteId: siteResult.data.id,
    siteName: normalizedSiteName,
    ownerId: siteResult.data.owner_id,
    createdAt: String(siteResult.data.created_at),
    isPersonalBlog,
    hasBeenOpenFor15Days,
    seriesPostCount,
    isEligible,
    hasStarted,
    isEnabled,
    isOwner,
    isSubscriber,
    stigmaId: session.stigmaId,
    canUse: isPersonalBlog && isEnabled && (isOwner || isSubscriber),
  };
}

export async function getBlogCommunityEnablement(siteName: string) {
  const context = await getBlogCommunityContext(siteName);
  if (!context) return null;

  const supabaseAdmin = getSupabaseAdmin();
  const identityResult = context.isOwner
    ? await supabaseAdmin
        .from('chorogons')
        .select('identity_verified_at, birth_date, birth_date_dummy')
        .eq('user_id', context.ownerId)
        .maybeSingle()
    : { data: null, error: null };

  if (identityResult.error) throw new Error('본인인증 정보를 불러오지 못했습니다.');

  const birthDate = getChorogonBirthDate(identityResult.data);
  const isIdentityVerified = Boolean(identityResult.data?.identity_verified_at);
  const isAtLeastAge14 = isIdentityVerified && isAtLeast14(birthDate);

  return {
    ...context,
    isIdentityVerified,
    isAtLeastAge14,
    canEnable: context.isPersonalBlog && context.isEligible && isIdentityVerified && isAtLeastAge14,
  };
}

export function assertBlogCommunityUse(context: BlogCommunityContext) {
  if (!context.isPersonalBlog) throw new Error('개인 블로그에서만 이용할 수 있습니다.');
  if (!context.isEnabled) throw new Error('블로그 커뮤니티를 사용하지 않고 있습니다.');
  if (!context.canUse) throw new Error('블로그 구독자만 이용할 수 있습니다.');
}
