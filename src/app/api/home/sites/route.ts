import { type NextRequest } from 'next/server';
import { getUsersWithMembershipFeature } from '@/lib/memberships/features';
import { getPublicSiteUrl } from '@/lib/siteUrl';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RhizomeRow = {
  owner_id: string | null;
  site_key: string;
  site_label: string;
  profile_picture: string | null;
  summary: string | null;
  site_type: string;
  created_at: string;
  profile_logo: string | null;
  promotion_image: string | null;
  member_count: number | null;
  post_count: number | null;
  custom_domain: string | null;
};

function getRelevanceScore(value: string, keyword: string) {
  const normalizedValue = normalizeText(value).toLocaleLowerCase();
  const normalizedKeyword = normalizeText(keyword).toLocaleLowerCase();

  if (!normalizedKeyword || !normalizedValue) {
    return 0;
  }

  if (normalizedValue === normalizedKeyword) {
    return 3;
  }

  if (normalizedValue.startsWith(normalizedKeyword)) {
    return 2;
  }

  return normalizedValue.includes(normalizedKeyword) ? 1 : 0;
}

function getPublicUrl(bucket: string, path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return null;
  }

  if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
    return normalizedPath;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from(bucket).getPublicUrl(normalizedPath);

  return publicUrl.data.publicUrl ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const sortBy = searchParams.get('sortBy') ?? 'created_at';
    const sortOrder = searchParams.get('sortOrder') ?? 'desc';
    const limitParam = searchParams.get('limit') ?? '10';
    const siteType = searchParams.get('siteType');
    const keyword = normalizeText(searchParams.get('keyword'));
    const isRelevanceSort = sortBy === 'relevance' && Boolean(keyword);

    if (keyword && keyword.length < 2) {
      return Response.json({ error: '검색어는 두 글자 이상 입력해주세요.' }, { status: 400 });
    }

    const ascending = sortOrder === 'asc';
    const parsedLimit = parseInt(limitParam, 10);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
    const membership = searchParams.get('membership');

    const supabaseAdmin = getSupabaseAdmin();

    let allowedSiteIds: string[] | null = null;
    if (membership === 'owner') {
      const { data: selections, error: selectionsError } = await supabaseAdmin
        .from('membership_selectors')
        .select('target_id')
        .eq('selector_type', 'owner_site')
        .limit(limit * 3);

      if (!selectionsError && selections) {
        allowedSiteIds = selections.map((s) => s.target_id);
      }
    }

    let query = supabaseAdmin
      .from('rhizomes')
      .select(
        'id, owner_id, site_key, site_label, profile_picture, summary, site_type, profile_logo, promotion_image, member_count, post_count, created_at, custom_domain',
      )
      .eq('visibility_type', 'public')
      .eq('is_shutdown', false)
      .or('is_blocked.eq.false,is_blocked.is.null');

    if (isRelevanceSort) {
      query = query.ilike('site_label', `%${keyword}%`).in('site_type', ['blog', 'community']);
    }

    if (siteType === 'blog' || siteType === 'community') {
      query = query.eq('site_type', siteType);
    }

    if (allowedSiteIds !== null) {
      if (allowedSiteIds.length > 0) {
        query = query.in('id', allowedSiteIds);
      } else {
        return Response.json({ sites: [] });
      }
    }

    const { data, error } = await query
      .order(isRelevanceSort ? 'created_at' : sortBy, { ascending })
      .limit(isRelevanceSort ? Math.max(limit * 10, 100) : limit);

    if (error || !data) {
      return Response.json({ error: '사이트 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const sitesData = (data as RhizomeRow[])
      .map((site) => ({
        site,
        relevance: isRelevanceSort ? getRelevanceScore(site.site_label, keyword) : 0,
      }))
      .sort((left, right) => right.relevance - left.relevance)
      .slice(0, limit)
      .map(({ site }) => site);
    const ownerIds = [
      ...new Set(sitesData.map((site) => site.owner_id).filter((ownerId): ownerId is string => Boolean(ownerId))),
    ];
    const ownerIdsWithDomainFeature = await getUsersWithMembershipFeature(ownerIds, 'owner_domain');

    const sites = sitesData.map((site) => ({
      site_key: site.site_key,
      site_url: getPublicSiteUrl({
        siteKey: site.site_key,
        customDomain: site.custom_domain,
        hasOwnerDomainFeature: ownerIdsWithDomainFeature.has(site.owner_id ?? ''),
      }),
      site_label: site.site_label,
      profile_picture: getPublicUrl('profile_picture', site.profile_picture),
      summary: site.summary,
      site_type: site.site_type,
      profile_logo: getPublicUrl('profile_logo', site.profile_logo),
      promotion_image: getPublicUrl('promotion-image', site.promotion_image),
      created_at: site.created_at,
      member_count: site.member_count,
      post_count: site.post_count,
    }));

    return Response.json({ sites });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '사이트 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '사이트 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
