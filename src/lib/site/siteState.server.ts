import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { hasMembershipFeature } from '@/lib/memberships/features';
import { normalizeText } from '@/lib/utils';

export type SiteRoutingInfo = {
  site_key: string | null;
  custom_domain: string | null;
  has_owner_domain_feature: boolean;
  visibility_type: string | null;
  is_shutdown: boolean | null;
  is_blocked: boolean | null;
  is_closed: boolean | null;
  is_membership_suspended: boolean;
  site_type: string | null;
  join_accept_status: string | null;
  join_accept_start_day: string | null;
  join_accept_end_day: string | null;
  has_categories: boolean;
  has_series: boolean;
  blog_type: string | null;
  is_blog_community_enabled: boolean;
};

export async function getSiteRoutingInfo({
  siteName,
  customDomain,
}: {
  siteName?: string;
  customDomain?: string;
}): Promise<SiteRoutingInfo | null> {
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const normalizedCustomDomain = normalizeText(customDomain).toLowerCase();

  if (!normalizedSiteName && !normalizedCustomDomain) {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const rhizomeQuery = supabaseAdmin
    .from('rhizomes')
    .select('id, owner_id, site_key, site_type, visibility_type, is_shutdown, is_blocked, is_closed, custom_domain');
  const rhizome = await (
    normalizedCustomDomain
      ? rhizomeQuery.eq('custom_domain', normalizedCustomDomain)
      : rhizomeQuery.eq('site_key', normalizedSiteName)
  ).maybeSingle();

  if (rhizome.error || !rhizome.data) {
    return null;
  }

  const siteId = rhizome.data.id as string;
  const ownerId = rhizome.data.owner_id as string | null;
  const siteType = rhizome.data.site_type as string | null;
  const isBlog = siteType === 'blog';

  const [
    hasOwnerDomainFeature,
    siteLimitResult,
    categoriesResult,
    seriesResult,
    communityResult,
    blogResult,
    blogCommunityResult,
  ] = await Promise.all([
    ownerId && rhizome.data.custom_domain ? hasMembershipFeature(ownerId, 'owner_domain') : Promise.resolve(false),
    ownerId && (siteType === 'blog' || siteType === 'community')
      ? Promise.all([
          hasMembershipFeature(ownerId, 'owner_unlimited_sites'),
          supabaseAdmin
            .from('rhizomes')
            .select('id')
            .eq('owner_id', ownerId)
            .eq('site_type', siteType)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true }),
        ])
      : Promise.resolve(null),
    isBlog
      ? supabaseAdmin.from('board_categories').select('id', { count: 'exact', head: true }).eq('site_id', siteId)
      : Promise.resolve({ count: 0, error: null }),
    supabaseAdmin.from('board_series').select('id', { count: 'exact', head: true }).eq('site_id', siteId),
    siteType === 'community'
      ? supabaseAdmin
          .from('communities')
          .select('join_accept_status, join_accept_start_day, join_accept_end_day')
          .eq('site_id', siteId)
          .maybeSingle()
      : Promise.resolve(null),
    isBlog
      ? supabaseAdmin.from('blogs').select('blog_type').eq('site_id', siteId).maybeSingle()
      : Promise.resolve(null),
    isBlog
      ? supabaseAdmin.from('blog_communities').select('is_enabled').eq('site_id', siteId).maybeSingle()
      : Promise.resolve(null),
  ]);

  const [hasUnlimitedSites, ownerSitesResult] = siteLimitResult ?? [false, null];
  const ownerSiteIds = ownerSitesResult?.data?.map((site) => site.id) ?? [];
  const community = communityResult && !communityResult.error ? communityResult.data : null;

  return {
    site_key: rhizome.data.site_key,
    custom_domain: rhizome.data.custom_domain,
    has_owner_domain_feature: hasOwnerDomainFeature,
    visibility_type: rhizome.data.visibility_type,
    is_shutdown: rhizome.data.is_shutdown,
    is_blocked: rhizome.data.is_blocked,
    is_closed: rhizome.data.is_closed,
    is_membership_suspended: !hasUnlimitedSites && ownerSiteIds.indexOf(siteId) > 0,
    site_type: siteType,
    join_accept_status: community?.join_accept_status ?? null,
    join_accept_start_day: community?.join_accept_start_day ?? null,
    join_accept_end_day: community?.join_accept_end_day ?? null,
    has_categories: !categoriesResult.error && Number(categoriesResult.count ?? 0) > 0,
    has_series: !seriesResult.error && Number(seriesResult.count ?? 0) > 0,
    blog_type: blogResult?.data?.blog_type ?? null,
    is_blog_community_enabled: blogCommunityResult?.data?.is_enabled === true,
  };
}
