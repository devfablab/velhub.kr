import { isAtLeast14 } from '@/lib/identity/age';
import { getChorogonBirthDate } from '@/lib/identity/chorogon';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

export const BLOG_AD_BUCKET = 'blog-ad-images';
export const MAX_BLOG_AD_ITEMS = 10;
export const MAX_BLOG_AD_IMAGE_SIZE = 1024 * 1024;
export const BLOG_AD_IMAGE_TYPES = new Set(['image/png', 'image/webp']);

export const BLOG_AD_REPORT_REASONS = [
  'unsafe_link',
  'illegal_or_harmful_site',
  'different_destination',
  'broken_link',
] as const;

export type BlogAdReportReason = (typeof BLOG_AD_REPORT_REASONS)[number];
export type BlogPostAdType = 'advertisement' | 'sponsorship';

export type BlogPostPromotionInput = {
  type?: unknown;
  sponsorName?: unknown;
  linkUrl?: unknown;
  items?: unknown;
};

export const BLOG_AD_REPORT_REASON_LABELS: Record<BlogAdReportReason, { title: string; description: string }> = {
  unsafe_link: {
    title: '안전하지 않은 링크입니다.',
    description: '피싱, 악성코드, 개인정보 탈취 등이 의심되는 경우',
  },
  illegal_or_harmful_site: {
    title: '불법 또는 유해한 사이트로 연결됩니다.',
    description: '불법 상품·도박·성인물 등 이용에 부적절한 사이트로 연결되는 경우',
  },
  different_destination: {
    title: '표시된 정보와 다른 사이트로 연결됩니다.',
    description: '상품명 또는 협찬사 정보와 관계없는 사이트로 연결되는 경우',
  },
  broken_link: {
    title: '링크가 동작하지 않습니다.',
    description: '페이지를 열 수 없거나 존재하지 않는 주소로 연결되는 경우',
  },
};

export function isBlogAdReportReason(value: unknown): value is BlogAdReportReason {
  return typeof value === 'string' && BLOG_AD_REPORT_REASONS.includes(value as BlogAdReportReason);
}

export function isImmediateBlogAdReport(reason: BlogAdReportReason) {
  return reason === 'illegal_or_harmful_site' || reason === 'different_destination';
}

export function isValidBlogAdUrl(value: string) {
  if (!value || value.length > 100) return false;

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function getBlogAdDomain(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
}

export function getBlogAdPublicImageUrl(path: string | null | undefined) {
  const normalizedPath = normalizeText(path);
  if (!normalizedPath) return null;

  return getSupabaseAdmin().storage.from(BLOG_AD_BUCKET).getPublicUrl(normalizedPath).data.publicUrl ?? null;
}

export function getRequiredBlogAdImageUrl(path: string | null | undefined) {
  const imageUrl = getBlogAdPublicImageUrl(path);
  if (!imageUrl) throw new Error('상품 썸네일 정보가 없습니다.');
  return imageUrl;
}

function hasBeenOpenForFifteenDays(createdAt: string) {
  const createdAtTime = new Date(createdAt).getTime();
  return Number.isFinite(createdAtTime) && createdAtTime + 15 * 24 * 60 * 60 * 1000 <= Date.now();
}

export async function getBlogAdSiteContext(siteName: string) {
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

  const [postsResult, viewsResult, settingsResult, session] = await Promise.all([
    supabaseAdmin
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteResult.data.id)
      .eq('published_status', 'published')
      .eq('is_closed', false),
    supabaseAdmin
      .from('posts')
      .select('post_count')
      .eq('site_id', siteResult.data.id)
      .eq('published_status', 'published')
      .eq('is_closed', false),
    supabaseAdmin
      .from('blog_ad_settings')
      .select('is_enabled, enabled_at')
      .eq('site_id', siteResult.data.id)
      .maybeSingle(),
    verifySession({ siteId: siteResult.data.id }),
  ]);

  if (postsResult.error || viewsResult.error || settingsResult.error) {
    throw new Error('광고 사용 조건을 확인하지 못했습니다.');
  }

  const postCount = postsResult.count ?? 0;
  const totalViews = (viewsResult.data ?? []).reduce((sum, post) => sum + Number(post.post_count ?? 0), 0);
  const hasBeenOpenFor15Days = hasBeenOpenForFifteenDays(String(siteResult.data.created_at));
  const isEligible = hasBeenOpenFor15Days && postCount >= 10 && totalViews >= 1000;
  const isOwner = session.case === 'admin' || session.stigmaId === siteResult.data.owner_id;

  return {
    siteId: String(siteResult.data.id),
    siteName: normalizedSiteName,
    ownerId: String(siteResult.data.owner_id),
    createdAt: String(siteResult.data.created_at),
    postCount,
    totalViews,
    hasBeenOpenFor15Days,
    isEligible,
    isEnabled: settingsResult.data?.is_enabled === true,
    isOwner,
    session,
    supabaseAdmin,
  };
}

export async function getBlogAdIdentityStatus(stigmaId: string | null | undefined) {
  if (!stigmaId) return { isIdentityVerified: false, isAtLeastAge14: false };

  const result = await getSupabaseAdmin()
    .from('chorogons')
    .select('identity_verified_at, birth_date, birth_date_dummy')
    .eq('user_id', stigmaId)
    .maybeSingle();

  if (result.error) throw new Error('본인인증 정보를 확인하지 못했습니다.');

  const isIdentityVerified = Boolean(result.data?.identity_verified_at);
  return {
    isIdentityVerified,
    isAtLeastAge14: isIdentityVerified && isAtLeast14(getChorogonBirthDate(result.data)),
  };
}

export async function assertBlogAdEditor({ siteName, postReference }: { siteName: string; postReference: string }) {
  const context = await getBlogAdSiteContext(siteName);
  if (!context) throw new Error('블로그를 찾을 수 없습니다.');
  if (!context.session.stigmaId || !['admin', 'staff', 'member'].includes(context.session.case)) {
    throw new Error('접근 권한이 없습니다.');
  }

  const postQuery = context.supabaseAdmin
    .from('posts')
    .select('id, site_id, user_id, series_id, is_closed, published_status')
    .eq('site_id', context.siteId);
  const postResult = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(postReference)
    ? await postQuery.eq('id', postReference).maybeSingle()
    : await postQuery.eq('slug', postReference).maybeSingle();

  if (postResult.error || !postResult.data || postResult.data.is_closed) throw new Error('글을 찾을 수 없습니다.');

  const canManage = context.session.case === 'admin' || context.session.case === 'staff';
  if (!canManage && postResult.data.user_id !== context.session.stigmaId) throw new Error('접근 권한이 없습니다.');

  const identity = await getBlogAdIdentityStatus(context.session.stigmaId);
  return { ...context, identity, post: postResult.data };
}

export async function isSubscriptionSeriesPost({ siteId, seriesId }: { siteId: string; seriesId: string | null }) {
  if (!seriesId) return false;
  const result = await getSupabaseAdmin()
    .from('board_series')
    .select('is_subscription')
    .eq('site_id', siteId)
    .eq('id', seriesId)
    .maybeSingle();
  if (result.error) throw new Error('연재 정보를 확인하지 못했습니다.');
  return result.data?.is_subscription === true;
}

export async function createBlogPostPromotion({
  siteName,
  postId,
  seriesId,
  input,
}: {
  siteName: string;
  postId: string;
  seriesId: string | null;
  input: BlogPostPromotionInput | null | undefined;
}) {
  const type = input?.type === 'advertisement' || input?.type === 'sponsorship' ? input.type : 'none';
  if (type === 'none') return;
  const context = await getBlogAdSiteContext(siteName);
  if (!context?.isEnabled || !context.isEligible) throw new Error('광고 사용 조건을 충족하지 않았습니다.');
  const identity = await getBlogAdIdentityStatus(context.session.stigmaId);
  if (!identity.isIdentityVerified) throw new Error('광고 또는 협찬을 설정하려면 본인인증이 필요합니다.');
  if (!identity.isAtLeastAge14) throw new Error('만 14세 미만은 광고 또는 협찬을 설정할 수 없습니다.');

  if (type === 'sponsorship') {
    const sponsorName = normalizeText(typeof input?.sponsorName === 'string' ? input.sponsorName : '');
    const linkUrl = normalizeText(typeof input?.linkUrl === 'string' ? input.linkUrl : '');
    if (!sponsorName || sponsorName.length > 50) throw new Error('협찬사명은 50자 이하로 입력해주세요.');
    if (!isValidBlogAdUrl(linkUrl)) throw new Error('링크는 100자 이하의 HTTPS 주소로 입력해주세요.');
    const result = await context.supabaseAdmin.from('blog_post_ads').insert({
      site_id: context.siteId,
      post_id: postId,
      ad_type: 'sponsorship',
      sponsor_name: sponsorName,
      product_name: null,
      thumbnail_image: null,
      link_url: linkUrl,
    });
    if (result.error) throw new Error('협찬 정보를 저장하지 못했습니다.');
    return;
  }
  const rawItems = Array.isArray(input?.items) ? input.items : [];
  const items = rawItems.map((item) => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    return {
      productName: normalizeText(typeof row.productName === 'string' ? row.productName : ''),
      thumbnailImage: normalizeText(typeof row.thumbnailImage === 'string' ? row.thumbnailImage : ''),
      linkUrl: normalizeText(typeof row.linkUrl === 'string' ? row.linkUrl : ''),
    };
  });
  const isSubscription = await isSubscriptionSeriesPost({ siteId: context.siteId, seriesId });
  if (!items.length || items.length > (isSubscription ? MAX_BLOG_AD_ITEMS : 1)) {
    throw new Error(
      isSubscription ? '상품은 최대 10개까지 등록할 수 있습니다.' : '이 글에는 상품을 1개만 등록할 수 있습니다.',
    );
  }
  if (
    items.some(
      (item) =>
        !item.productName || item.productName.length > 50 || !item.thumbnailImage || !isValidBlogAdUrl(item.linkUrl),
    )
  ) {
    throw new Error('상품명, 상품 썸네일, HTTPS 링크를 확인해주세요.');
  }
  if (isSubscription) {
    const result = await context.supabaseAdmin.from('blog_ads').insert(
      items.map((item, sortOrder) => ({
        site_id: context.siteId,
        post_id: postId,
        product_name: item.productName,
        thumbnail_image: item.thumbnailImage,
        link_url: item.linkUrl,
        sort_order: sortOrder,
      })),
    );
    if (result.error) throw new Error('상품 광고를 저장하지 못했습니다.');
    return;
  }
  const item = items[0];
  const result = await context.supabaseAdmin.from('blog_post_ads').insert({
    site_id: context.siteId,
    post_id: postId,
    ad_type: 'advertisement',
    product_name: item.productName,
    sponsor_name: null,
    thumbnail_image: item.thumbnailImage,
    link_url: item.linkUrl,
  });
  if (result.error) throw new Error('상품 광고를 저장하지 못했습니다.');
}

type PromotionTarget = {
  id: string;
  product_name?: string | null;
  sponsor_name?: string | null;
  thumbnail_image?: string | null;
  link_url: string;
};

async function filterBlockedPromotionTargets({
  target,
  rows,
}: {
  target: 'blog_ad_id' | 'blog_post_ad_id';
  rows: PromotionTarget[];
}) {
  if (!rows.length) return [];
  const reports = await getSupabaseAdmin()
    .from('blog_ad_reports')
    .select(`${target}, reason, status`)
    .in(
      target,
      rows.map((row) => row.id),
    );
  if (reports.error) throw new Error('광고 상태를 확인하지 못했습니다.');
  const blockedIds = new Set(
    (reports.data ?? [])
      .filter(
        (report) =>
          report.status === 'issue' ||
          (report.status === 'pending' &&
            (report.reason === 'illegal_or_harmful_site' || report.reason === 'different_destination')),
      )
      .map((report) => String((report as Record<string, unknown>)[target] ?? ''))
      .filter(Boolean),
  );
  return rows.filter((row) => !blockedIds.has(row.id));
}

export async function getVisibleBlogPostPromotion({
  siteId,
  postId,
  seriesId,
}: {
  siteId: string;
  postId: string;
  seriesId: string | null;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const settings = await supabaseAdmin
    .from('blog_ad_settings')
    .select('is_enabled')
    .eq('site_id', siteId)
    .maybeSingle();
  if (settings.error) throw new Error('광고 상태를 확인하지 못했습니다.');
  if (settings.data?.is_enabled !== true) return { sponsorship: null, ads: [] };

  const [postAds, multiAds] = await Promise.all([
    supabaseAdmin
      .from('blog_post_ads')
      .select('id, ad_type, product_name, sponsor_name, thumbnail_image, link_url')
      .eq('post_id', postId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabaseAdmin
      .from('blog_ads')
      .select('id, product_name, thumbnail_image, link_url, sort_order')
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('sort_order'),
  ]);
  if (postAds.error || multiAds.error) throw new Error('광고 정보를 불러오지 못했습니다.');

  if (postAds.data?.ad_type === 'sponsorship') {
    const visible = await filterBlockedPromotionTargets({ target: 'blog_post_ad_id', rows: [postAds.data] });
    const sponsor = visible[0];
    return {
      sponsorship: sponsor
        ? {
            id: sponsor.id,
            sponsorName: sponsor.sponsor_name ?? '',
            linkUrl: sponsor.link_url,
            targetType: 'postAd' as const,
          }
        : null,
      ads: [],
    };
  }

  if (postAds.data?.ad_type === 'advertisement') {
    const visible = await filterBlockedPromotionTargets({ target: 'blog_post_ad_id', rows: [postAds.data] });
    return {
      sponsorship: null,
      ads: visible.map((ad) => ({
        id: ad.id,
        productName: ad.product_name ?? '',
        thumbnailUrl: getRequiredBlogAdImageUrl(ad.thumbnail_image),
        linkUrl: ad.link_url,
        domain: getBlogAdDomain(ad.link_url),
        targetType: 'postAd' as const,
      })),
    };
  }

  if ((multiAds.data ?? []).length) {
    const visible = await filterBlockedPromotionTargets({ target: 'blog_ad_id', rows: multiAds.data ?? [] });
    return {
      sponsorship: null,
      ads: visible.map((ad) => ({
        id: ad.id,
        productName: ad.product_name ?? '',
        thumbnailUrl: getRequiredBlogAdImageUrl(ad.thumbnail_image),
        linkUrl: ad.link_url,
        domain: getBlogAdDomain(ad.link_url),
        targetType: 'ad' as const,
      })),
    };
  }

  // 기본 광고는 연재글에만 적용됩니다. 비연재 글은 여기서 빈 광고 영역으로 끝납니다.
  if (!seriesId) return { sponsorship: null, ads: [] };

  const commonAds = await supabaseAdmin
    .from('blog_ads')
    .select('id, product_name, thumbnail_image, link_url, sort_order')
    .eq('site_id', siteId)
    .is('post_id', null)
    .is('deleted_at', null)
    .order('sort_order');
  if (commonAds.error) throw new Error('기본 광고를 불러오지 못했습니다.');
  const visible = await filterBlockedPromotionTargets({ target: 'blog_ad_id', rows: commonAds.data ?? [] });

  return {
    sponsorship: null,
    ads: visible.map((ad) => ({
      id: ad.id,
      productName: ad.product_name ?? '',
      thumbnailUrl: getRequiredBlogAdImageUrl(ad.thumbnail_image),
      linkUrl: ad.link_url,
      domain: getBlogAdDomain(ad.link_url),
      targetType: 'ad' as const,
    })),
  };
}
