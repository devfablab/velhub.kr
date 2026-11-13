import { cache } from 'react';
import { AUTO_OG_IMAGE_HEIGHT, AUTO_OG_IMAGE_WIDTH, getAutoOgImageUrl } from '@/lib/board/postThumbnail';
import { r2Storage } from '@/lib/clients/r2Storage';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { isMinor } from '@/lib/identity/age';
import { getChorogonBirthDate } from '@/lib/identity/chorogon';
import { getUsersWithMembershipFeature } from '@/lib/memberships/features';
import { getSiteCategoryGroups } from '@/lib/service/siteCategories';
import { getPublicSiteUrl } from '@/lib/siteUrl';
import { normalizeText } from '@/lib/utils';

export const PERIOD_DAYS = [1, 3, 5, 7, 15, 27, 50, 70, 90, 120, 150, 170, 200, 230, 250, 270, 300, 330, 365];

type CreatorRow = {
  id: string;
  user_id: string;
  handle_name: string;
  cover_image: string | null;
  introduction: string | null;
  created_at: string;
};

type MomentCreator = {
  id: string;
  userId: string;
  handleName: string;
  activityName: string;
  profileImage: string | null;
  coverImage: string | null;
  introduction: string | null;
  createdAt: string;
};

type SiteRow = {
  id: string;
  owner_id: string | null;
  site_key: string;
  site_label: string;
  summary: string | null;
  site_type: 'blog' | 'community';
  profile_picture: string | null;
  promotion_image: string | null;
  custom_domain: string | null;
  member_count: number | null;
  post_count: number | null;
  profile_logo: string | null;
  category_id?: number | null;
};

type BoardRow = {
  id: string;
  site_id: string;
  board_key: string;
  board_type: 'basic' | 'blog' | 'feed' | 'gallery' | 'youtube';
  write_permission: string | null;
};

type MomentPostRow = {
  id: string;
  site_id: string;
  board_id: string;
  user_id: string;
  slug: string | number;
  subject: string | null;
  summary: string | null;
  content_html: string | null;
  content_simple: string | null;
  images: Array<{ path?: string; width?: unknown; height?: unknown }> | null;
  thumbnail_image: string | null;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
  auto_og_image: string | null;
  youtube_id: string | null;
  youtube_url: string | null;
  published_at: string;
  series_id: string | null;
};

export type MomentCreatorCard = {
  handleName: string;
  activityName: string;
  profileImage: string | null;
  coverImage: string | null;
  introduction: string | null;
  createdAt: string;
};

export type MomentSiteCard = {
  site_key: string;
  site_url: string;
  site_label: string;
  summary: string | null;
  site_type: 'blog' | 'community';
  created_at: string;
};

export type MomentSiteHitCard = MomentSiteCard & {
  member_count: number | null;
  post_count: number | null;
  profile_picture: string | null;
  promotion_image: string | null;
  profile_logo: string | null;
};

export type MomentAudience = 'creator' | 'owner' | 'newbie' | 'all';

export type MomentPostCard = {
  post_id: string;
  author_id: string;
  site_key: string;
  site_url: string;
  site_label: string;
  site_type: 'blog' | 'community';
  profile_picture: string | null;
  promotion_image: string | null;
  slug: string;
  board_key: string;
  board_type: 'basic' | 'blog' | 'feed' | 'gallery' | 'youtube';
  author_name: string;
  author_avatar: string | null;
  published_at: string;
  subject?: string | null;
  summary?: string | null;
  content_html?: string | null;
  content_simple?: string | null;
  image?: string | null;
  image_width?: number | null;
  image_height?: number | null;
  thumbnail_image?: string | null;
  thumbnail_width?: number | null;
  thumbnail_height?: number | null;
  youtube_id?: string | null;
};

export function getDateBefore(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// Supabase(PostgREST)는 요청당 최대 1000건(max_rows)만 반환하므로 range로 나눠 읽는다.
const PAGE_ROWS = 1000;

export async function fetchPagedRows<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  maxRows = Number.POSITIVE_INFINITY,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; from < maxRows; from += PAGE_ROWS) {
    const to = Math.min(from + PAGE_ROWS, maxRows) - 1;
    const result = await load(from, to);
    if (result.error) throw result.error;
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < to - from + 1) break;
  }

  return rows;
}

function toPublicUrl(bucket: string, path: string | null | undefined) {
  const normalizedPath = normalizeText(path);
  if (!normalizedPath) return null;
  if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) return normalizedPath;
  return r2Storage.from(bucket).getPublicUrl(normalizedPath).data.publicUrl ?? null;
}

function toImageDimension(value: unknown) {
  const dimension = typeof value === 'string' ? Number(value) : value;
  return typeof dimension === 'number' && Number.isFinite(dimension) && dimension > 0 ? dimension : null;
}

function getListThumbnail(
  post: Pick<MomentPostRow, 'thumbnail_image' | 'thumbnail_width' | 'thumbnail_height' | 'auto_og_image'>,
) {
  const thumbnailImage = toPostThumbnailUrl(post.thumbnail_image);

  if (thumbnailImage) {
    return {
      thumbnail_image: thumbnailImage,
      thumbnail_width: toImageDimension(post.thumbnail_width),
      thumbnail_height: toImageDimension(post.thumbnail_height),
    };
  }

  const autoOgImage = getAutoOgImageUrl(post.auto_og_image);

  return {
    thumbnail_image: autoOgImage || null,
    thumbnail_width: autoOgImage ? AUTO_OG_IMAGE_WIDTH : null,
    thumbnail_height: autoOgImage ? AUTO_OG_IMAGE_HEIGHT : null,
  };
}

function toPostThumbnailUrl(path: string | null | undefined) {
  const normalizedPath = normalizeText(path);
  if (!normalizedPath) return null;
  return toPublicUrl(normalizedPath.includes('/') ? 'post' : 'og-image', normalizedPath);
}

function getFirstPostImage(images: MomentPostRow['images']) {
  const firstImage = Array.isArray(images) ? images[0] : null;
  return {
    image: toPublicUrl('post', firstImage?.path),
    image_width: toImageDimension(firstImage?.width),
    image_height: toImageDimension(firstImage?.height),
  };
}

function pickWithDynamicPeriod<T>(
  rows: T[],
  limit: number,
  getDate: (row: T) => string,
  compare: (left: T, right: T) => number,
) {
  const sortedRows = [...rows].sort(compare);

  for (const days of PERIOD_DAYS) {
    const selected = sortedRows.filter((row) => getDate(row) >= getDateBefore(days));
    if (selected.length >= limit) return selected.slice(0, limit);
  }

  return sortedRows.slice(0, limit);
}

const getMomentCreators = cache(async (): Promise<MomentCreator[]> => {
  const supabaseAdmin = getSupabaseAdmin();
  const creatorRows = await fetchPagedRows<CreatorRow>((from, to) =>
    supabaseAdmin
      .from('creators')
      .select('id, user_id, handle_name, cover_image, introduction, created_at')
      .order('id', { ascending: true })
      .range(from, to),
  );
  const userIds = [...new Set(creatorRows.map((creator) => creator.user_id))];
  if (userIds.length === 0) return [];

  const [loungeUsers, stigmasResult, identitiesResult] = await Promise.all([
    getUsersWithMembershipFeature(userIds, 'creator_lounge'),
    supabaseAdmin.from('stigmas').select('id, user_name, avatar').in('id', userIds),
    supabaseAdmin.from('chorogons').select('id, user_id, birth_date, birth_date_dummy').in('user_id', userIds),
  ]);

  if (stigmasResult.error || identitiesResult.error) throw stigmasResult.error ?? identitiesResult.error;
  const identities = identitiesResult.data ?? [];
  const identityByUserId = new Map(identities.map((identity) => [identity.user_id, identity]));
  const identityIds = identities.map((identity) => identity.id);
  if (identityIds.length === 0) return [];

  const settlementsResult = await supabaseAdmin
    .from('chorogons_banque')
    .select('chorogon_id, is_author, is_guardian_approved, status')
    .in('chorogon_id', identityIds);

  if (settlementsResult.error) throw settlementsResult.error;
  const settlementByIdentityId = new Map(
    (settlementsResult.data ?? []).map((settlement) => [settlement.chorogon_id, settlement]),
  );
  const stigmaById = new Map((stigmasResult.data ?? []).map((stigma) => [stigma.id, stigma]));

  return creatorRows.flatMap((creator) => {
    const identity = identityByUserId.get(creator.user_id);
    const settlement = identity ? settlementByIdentityId.get(identity.id) : null;
    const stigma = stigmaById.get(creator.user_id);
    const authorAvailable =
      Boolean(settlement?.is_author) &&
      settlement?.status === 'approved' &&
      !(identity && isMinor(getChorogonBirthDate(identity)) && settlement?.is_guardian_approved !== true);

    if (!loungeUsers.has(creator.user_id) || !authorAvailable) return [];

    let activityName = creator.handle_name;
    if (stigma?.user_name) {
      try {
        activityName = decrypt(stigma.user_name);
      } catch {
        activityName = creator.handle_name;
      }
    }

    return [
      {
        id: creator.id,
        userId: creator.user_id,
        handleName: creator.handle_name,
        activityName,
        profileImage: toPublicUrl('avatar', stigma?.avatar),
        coverImage: toPublicUrl('cover-image', creator.cover_image),
        introduction: creator.introduction,
        createdAt: creator.created_at,
      },
    ];
  });
});

const getMomentOwnerUserIds = cache(async (): Promise<string[]> => {
  const supabaseAdmin = getSupabaseAdmin();
  const sites = await fetchPagedRows<{ owner_id: string | null }>(
    (from, to) =>
      supabaseAdmin
        .from('rhizomes')
        .select('owner_id')
        .in('site_type', ['blog', 'community'])
        .eq('visibility_type', 'public')
        .eq('is_shutdown', false)
        .or('is_blocked.eq.false,is_blocked.is.null')
        .not('owner_id', 'is', null)
        .order('id', { ascending: true })
        .range(from, to),
    5000,
  );

  const ownerUserIds = [...new Set(sites.flatMap((site) => (site.owner_id ? [site.owner_id] : [])))];
  if (!ownerUserIds.length) return [];

  return [...(await getUsersWithMembershipFeature(ownerUserIds, 'owner_lounge'))];
});

const getMomentAudienceUserIds = cache(async (audience: Exclude<MomentAudience, 'all'>): Promise<string[]> => {
  if (audience === 'creator') {
    return (await getMomentCreators()).map((creator) => creator.userId);
  }

  const ownerUserIds = await getMomentOwnerUserIds();
  if (audience === 'owner') return ownerUserIds;

  const creatorUserIds = (await getMomentCreators()).map((creator) => creator.userId);
  return [...new Set([...creatorUserIds, ...ownerUserIds])];
});

async function getMomentSitesForAudience(audience: Exclude<MomentAudience, 'all'>): Promise<SiteRow[]> {
  const ownerUserIds = await getMomentAudienceUserIds(audience);
  if (!ownerUserIds.length) return [];

  const supabaseAdmin = getSupabaseAdmin();
  return fetchPagedRows<SiteRow>(
    (from, to) =>
      supabaseAdmin
        .from('rhizomes')
        .select(
          'id, owner_id, site_key, site_label, summary, site_type, profile_picture, profile_logo, promotion_image, custom_domain, member_count, post_count, category_id',
        )
        .in('owner_id', ownerUserIds)
        .in('site_type', ['blog', 'community'])
        .eq('visibility_type', 'public')
        .eq('is_shutdown', false)
        .or('is_blocked.eq.false,is_blocked.is.null')
        .order('id', { ascending: true })
        .range(from, to),
    5000,
  );
}

export async function getNewMomentSites(limit = 20, audience: MomentAudience = 'creator'): Promise<MomentSiteCard[]> {
  const audienceUserIds = audience === 'all' ? null : await getMomentAudienceUserIds(audience);
  if (audienceUserIds && audienceUserIds.length === 0) return [];

  const supabaseAdmin = getSupabaseAdmin();
  const sites = await fetchPagedRows<SiteRow>((from, to) => {
    let sitesQuery = supabaseAdmin
      .from('rhizomes')
      .select(
        'id, owner_id, site_key, site_label, summary, site_type, profile_picture, profile_logo, promotion_image, custom_domain, member_count, post_count',
      )
      .in('site_type', ['blog', 'community'])
      .eq('visibility_type', 'public')
      .eq('is_shutdown', false)
      .or('is_blocked.eq.false,is_blocked.is.null');
    if (audienceUserIds) sitesQuery = sitesQuery.in('owner_id', audienceUserIds);
    return sitesQuery.order('id', { ascending: true }).range(from, to);
  }, 5000);

  if (sites.length === 0) return [];

  const sitePosts = await fetchPagedRows<{ site_id: string; published_at: string | null }>(
    (from, to) =>
      supabaseAdmin
        .from('posts')
        .select('site_id, published_at')
        .in(
          'site_id',
          sites.map((site) => site.id),
        )
        .eq('published_status', 'published')
        .eq('is_closed', false)
        .eq('is_wording_blinded', false)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    10000,
  );

  const firstPublishedAtBySiteId = new Map<string, string>();
  sitePosts.forEach((post) => {
    if (!firstPublishedAtBySiteId.has(post.site_id) && post.published_at) {
      firstPublishedAtBySiteId.set(post.site_id, post.published_at);
    }
  });

  const ownerIdsWithDomainFeature = await getUsersWithMembershipFeature(
    sites.map((site) => site.owner_id).filter((ownerId): ownerId is string => Boolean(ownerId)),
    'owner_domain',
  );
  const eligibleSites = sites.flatMap((site) => {
    const firstPublishedAt = firstPublishedAtBySiteId.get(site.id);
    if (!firstPublishedAt) return [];
    return [{ site, firstPublishedAt }];
  });

  return pickWithDynamicPeriod(
    eligibleSites,
    limit,
    (item) => item.firstPublishedAt,
    (left, right) => right.firstPublishedAt.localeCompare(left.firstPublishedAt),
  ).map(({ site, firstPublishedAt }) => ({
    site_key: site.site_key,
    site_url: getPublicSiteUrl({
      siteKey: site.site_key,
      customDomain: site.custom_domain,
      hasOwnerDomainFeature: ownerIdsWithDomainFeature.has(site.owner_id ?? ''),
    }),
    site_label: site.site_label,
    summary: site.summary,
    site_type: site.site_type,
    created_at: firstPublishedAt,
  }));
}

export async function getNewMomentCreators(limit = 20): Promise<MomentCreatorCard[]> {
  const creators = await getMomentCreators();
  return pickWithDynamicPeriod(
    creators,
    limit,
    (creator) => creator.createdAt,
    (left, right) => right.createdAt.localeCompare(left.createdAt),
  ).map((creator) => ({
    handleName: creator.handleName,
    activityName: creator.activityName,
    profileImage: creator.profileImage,
    coverImage: creator.coverImage,
    introduction: creator.introduction,
    createdAt: creator.createdAt,
  }));
}

export async function getRisingMomentCreators(limit = 20): Promise<MomentCreatorCard[]> {
  const creators = await getMomentCreators();
  if (creators.length === 0) return [];
  const supabaseAdmin = getSupabaseAdmin();
  const creatorIds = creators.map((creator) => creator.id);
  const follows = await fetchPagedRows<{ creator_id: string; created_at: string }>(
    (from, to) =>
      supabaseAdmin
        .from('creator_follows')
        .select('creator_id, created_at')
        .in('creator_id', creatorIds)
        .gte('created_at', getDateBefore(PERIOD_DAYS[PERIOD_DAYS.length - 1]))
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to),
    10000,
  );
  const creatorById = new Map(creators.map((creator) => [creator.id, creator]));

  // 기간 내 새 팔로우 수 순. 365일까지 넓혀도 limit개가 안 되면 팔로우가 있는 서재만 노출
  let ranked: Array<{ creator: MomentCreator; count: number }> = [];
  for (const days of PERIOD_DAYS) {
    const start = getDateBefore(days);
    const countByCreatorId = new Map<string, number>();
    follows.forEach((follow) => {
      if (follow.created_at >= start)
        countByCreatorId.set(follow.creator_id, (countByCreatorId.get(follow.creator_id) ?? 0) + 1);
    });
    ranked = [...countByCreatorId.entries()]
      .flatMap(([creatorId, count]) => {
        const creator = creatorById.get(creatorId);
        return creator ? [{ creator, count }] : [];
      })
      .sort((left, right) => right.count - left.count || right.creator.createdAt.localeCompare(left.creator.createdAt));
    if (ranked.length >= limit) break;
  }

  return ranked.slice(0, limit).map(({ creator }) => ({
    handleName: creator.handleName,
    activityName: creator.activityName,
    profileImage: creator.profileImage,
    coverImage: creator.coverImage,
    introduction: creator.introduction,
    createdAt: creator.createdAt,
  }));
}

const getMomentPosts = cache(
  async (
    audience: Exclude<MomentAudience, 'all'> = 'creator',
  ): Promise<{ posts: MomentPostCard[]; sourceRows: MomentPostRow[] }> => {
    const creators = audience === 'creator' ? await getMomentCreators() : [];
    const creatorByUserId = new Map(creators.map((creator) => [creator.userId, creator]));
    const userIds = [...creatorByUserId.keys()];
    if (audience === 'creator' && userIds.length === 0) return { posts: [], sourceRows: [] };

    const supabaseAdmin = getSupabaseAdmin();
    const postRows = await fetchPagedRows<MomentPostRow>((from, to) => {
      let postsQuery = supabaseAdmin
        .from('posts')
        .select(
          'id, site_id, board_id, user_id, slug, subject, summary, content_html, content_simple, images, thumbnail_image, thumbnail_width, thumbnail_height, auto_og_image, youtube_id, youtube_url, published_at, series_id',
        )
        .eq('published_status', 'published')
        .eq('is_closed', false)
        .eq('is_wording_blinded', false)
        .not('published_at', 'is', null);
      if (audience === 'creator') postsQuery = postsQuery.in('user_id', userIds);
      return postsQuery
        .order('published_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: MomentPostRow[] | null; error: unknown }>;
    }, 5000);
    if (postRows.length === 0) return { posts: [], sourceRows: [] };

    const boardIds = [...new Set(postRows.map((post) => post.board_id))];
    const boardsResult = await supabaseAdmin
      .from('boards')
      .select('id, site_id, board_key, board_type, write_permission')
      .in('id', boardIds)
      .in('board_type', ['basic', 'blog', 'feed', 'gallery', 'youtube']);

    if (boardsResult.error) throw boardsResult.error;
    const boardById = new Map(((boardsResult.data ?? []) as BoardRow[]).map((board) => [board.id, board]));
    const siteIds = [...new Set([...boardById.values()].map((board) => board.site_id))];
    if (siteIds.length === 0) return { posts: [], sourceRows: [] };

    let sitesQuery = supabaseAdmin
      .from('rhizomes')
      .select(
        'id, owner_id, site_key, site_label, summary, site_type, profile_picture, profile_logo, promotion_image, custom_domain, member_count, post_count',
      )
      .in('id', siteIds)
      .in('site_type', ['blog', 'community'])
      .eq('visibility_type', 'public')
      .eq('is_shutdown', false)
      .or('is_blocked.eq.false,is_blocked.is.null');
    if (audience !== 'creator') {
      const audienceUserIds = await getMomentAudienceUserIds(audience);
      if (!audienceUserIds.length) return { posts: [], sourceRows: [] };
      sitesQuery = sitesQuery.in('owner_id', audienceUserIds);
    }

    const sitesResult = await sitesQuery;
    if (sitesResult.error) throw sitesResult.error;
    const siteById = new Map(((sitesResult.data ?? []) as SiteRow[]).map((site) => [site.id, site]));
    const ownerIdsWithDomainFeature = await getUsersWithMembershipFeature(
      [...siteById.values()].map((site) => site.owner_id).filter((ownerId): ownerId is string => Boolean(ownerId)),
      'owner_domain',
    );

    const resolvedRows = postRows.filter((post) => {
      const board = boardById.get(post.board_id);
      const site = board ? siteById.get(board.site_id) : null;
      if (!board || !site) return false;
      if (audience === 'newbie') return !(board.board_type !== 'blog' && board.write_permission === 'manager');
      return site.site_type === 'blog' || Boolean(post.series_id);
    });
    const postUserIds = [...new Set(resolvedRows.map((post) => post.user_id).filter(Boolean))];
    const stigmasResult = postUserIds.length
      ? await supabaseAdmin.from('stigmas').select('id, user_name, avatar').in('id', postUserIds)
      : { data: [], error: null };
    if (stigmasResult.error) throw stigmasResult.error;
    const stigmaById = new Map((stigmasResult.data ?? []).map((stigma) => [stigma.id, stigma]));

    const posts: MomentPostCard[] = resolvedRows.flatMap<MomentPostCard>((post): MomentPostCard[] => {
      const board = boardById.get(post.board_id);
      const site = board ? siteById.get(board.site_id) : null;
      const creator = creatorByUserId.get(post.user_id);
      const stigma = stigmaById.get(post.user_id);
      if (!board || !site || (audience === 'creator' && !creator)) return [];
      let authorName = creator?.activityName ?? '작성자';
      if (!creator && stigma?.user_name) {
        try {
          authorName = decrypt(stigma.user_name);
        } catch {
          // 복호화할 수 없는 활동명은 기본 이름으로 표시한다.
        }
      }

      const base: MomentPostCard = {
        post_id: post.id,
        author_id: post.user_id,
        site_key: site.site_key,
        site_url: getPublicSiteUrl({
          siteKey: site.site_key,
          customDomain: site.custom_domain,
          hasOwnerDomainFeature: ownerIdsWithDomainFeature.has(site.owner_id ?? ''),
        }),
        site_label: site.site_label,
        site_type: site.site_type,
        profile_picture: toPublicUrl('avatar', site.profile_picture),
        promotion_image: toPublicUrl('promotion-image', site.promotion_image),
        slug: String(post.slug),
        board_key: board.board_key,
        board_type: board.board_type,
        author_name: authorName,
        author_avatar: creator?.profileImage ?? toPublicUrl('avatar', stigma?.avatar),
        published_at: post.published_at,
      };

      if (board.board_type === 'gallery') {
        return [
          {
            ...base,
            subject: post.subject,
            summary: post.summary,
            content_html: post.content_html,
            ...getFirstPostImage(post.images),
          },
        ];
      }

      if (board.board_type === 'youtube') {
        return [
          {
            ...base,
            subject: post.subject,
            summary: post.summary,
            thumbnail_image: toPostThumbnailUrl(post.thumbnail_image),
            thumbnail_width: toImageDimension(post.thumbnail_width),
            thumbnail_height: toImageDimension(post.thumbnail_height),
            youtube_id: post.youtube_id,
          },
        ];
      }

      if (board.board_type === 'feed') {
        return [
          {
            ...base,
            content_simple: post.content_simple,
            ...getFirstPostImage(post.images),
          },
        ];
      }

      return [
        {
          ...base,
          subject: post.subject,
          content_html: post.content_html,
          ...getListThumbnail(post),
        },
      ];
    });

    const visiblePostIds = new Set(posts.map((post) => `${post.site_key}:${post.board_key}:${post.slug}`));
    return {
      posts,
      sourceRows: resolvedRows.filter((post) => {
        const board = boardById.get(post.board_id);
        const site = board ? siteById.get(board.site_id) : null;
        return Boolean(board && site && visiblePostIds.has(`${site.site_key}:${board.board_key}:${post.slug}`));
      }),
    };
  },
);

export async function getRecentMomentPosts(
  limit = 50,
  audience: Exclude<MomentAudience, 'all'> = 'creator',
): Promise<MomentPostCard[]> {
  const { posts } = await getMomentPosts(audience);
  const byAuthor = (items: MomentPostCard[]) => {
    const seenAuthors = new Set<string>();
    return items.filter((post) => {
      if (seenAuthors.has(post.author_id)) return false;
      seenAuthors.add(post.author_id);
      return true;
    });
  };

  const sortedPosts = [...posts].sort((left, right) => right.published_at.localeCompare(left.published_at));
  for (const days of PERIOD_DAYS) {
    const selected = byAuthor(sortedPosts.filter((post) => post.published_at >= getDateBefore(days)));
    if (selected.length >= limit) return selected.slice(0, limit);
  }
  return byAuthor(sortedPosts).slice(0, limit);
}

async function getPostScoreMap(
  postIds: string[],
  table: 'post_likes' | 'post_view_daily_stats',
): Promise<Map<string, Array<{ createdAt: string; score: number }>>> {
  const supabaseAdmin = getSupabaseAdmin();
  const scoreMap = new Map<string, Array<{ createdAt: string; score: number }>>();
  const start = getDateBefore(365);

  for (let index = 0; index < postIds.length; index += 500) {
    const postIdChunk = postIds.slice(index, index + 500);
    if (table === 'post_likes') {
      const likes = await fetchPagedRows<{ post_id: string; created_at: string }>((from, to) =>
        supabaseAdmin
          .from('post_likes')
          .select('post_id, created_at')
          .in('post_id', postIdChunk)
          .gte('created_at', start)
          .order('id', { ascending: true })
          .range(from, to),
      );
      likes.forEach((row) => {
        const rows = scoreMap.get(row.post_id) ?? [];
        rows.push({ createdAt: row.created_at, score: 1 });
        scoreMap.set(row.post_id, rows);
      });
      continue;
    }

    const views = await fetchPagedRows<{ post_id: string; view_date: string; view_count: number | null }>((from, to) =>
      supabaseAdmin
        .from('post_view_daily_stats')
        .select('post_id, view_date, view_count')
        .in('post_id', postIdChunk)
        .gte('view_date', start.slice(0, 10))
        .order('post_id', { ascending: true })
        .order('view_date', { ascending: true })
        .range(from, to),
    );
    views.forEach((row) => {
      const rows = scoreMap.get(row.post_id) ?? [];
      rows.push({ createdAt: `${row.view_date}T00:00:00.000Z`, score: Number(row.view_count ?? 0) });
      scoreMap.set(row.post_id, rows);
    });
  }

  return scoreMap;
}

async function getRankedMomentPosts(
  limit: number,
  table: 'post_likes' | 'post_view_daily_stats',
  audience: Exclude<MomentAudience, 'all'> = 'creator',
) {
  const { posts } = await getMomentPosts(audience);
  const postById = new Map(posts.map((post) => [post.post_id, post]));
  const scoreMap = await getPostScoreMap([...postById.keys()], table);

  // 기간 내 점수(좋아요/조회수) 순. 365일까지 넓혀도 limit개가 안 되면 점수 0인 글로 채우지 않고 있는 만큼만 노출
  let ranked: Array<{ post: MomentPostCard; score: number }> = [];
  for (const days of PERIOD_DAYS) {
    const start = getDateBefore(days);
    ranked = [...postById.entries()]
      .map(([postId, post]) => ({
        post,
        score: (scoreMap.get(postId) ?? [])
          .filter((entry) => entry.createdAt >= start)
          .reduce((total, entry) => total + entry.score, 0),
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || right.post.published_at.localeCompare(left.post.published_at));
    if (ranked.length >= limit) break;
  }

  return ranked.slice(0, limit).map((item) => item.post);
}

type RisingEntry = { createdAt: string; score: number };

async function getSiteRisingEntries(sites: SiteRow[]): Promise<Map<string, RisingEntry[]>> {
  const entriesMap = new Map<string, RisingEntry[]>();
  const pushEntry = (siteId: string, entry: RisingEntry) => {
    const entries = entriesMap.get(siteId) ?? [];
    entries.push(entry);
    entriesMap.set(siteId, entries);
  };
  const supabaseAdmin = getSupabaseAdmin();
  const start = getDateBefore(365);
  const blogSites = sites.filter((site) => site.site_type === 'blog');
  const communitySites = sites.filter((site) => site.site_type === 'community');

  if (blogSites.length) {
    const blogSiteIds = blogSites.map((site) => site.id);
    const posts: Array<{ id: string; site_id: string }> = [];
    for (let index = 0; index < blogSiteIds.length; index += 500) {
      posts.push(
        ...(await fetchPagedRows<{ id: string; site_id: string }>((from, to) =>
          supabaseAdmin
            .from('posts')
            .select('id, site_id')
            .in('site_id', blogSiteIds.slice(index, index + 500))
            .eq('published_status', 'published')
            .eq('is_closed', false)
            .eq('is_wording_blinded', false)
            .order('id', { ascending: true })
            .range(from, to),
        )),
      );
    }
    const scoreMap = await getPostScoreMap(
      posts.map((post) => post.id),
      'post_likes',
    );
    posts.forEach((post) => (scoreMap.get(post.id) ?? []).forEach((entry) => pushEntry(post.site_id, entry)));

    for (let index = 0; index < blogSiteIds.length; index += 500) {
      const favorites = await fetchPagedRows<{ site_id: string; created_at: string }>((from, to) =>
        supabaseAdmin
          .from('blog_favorites')
          .select('site_id, created_at')
          .in('site_id', blogSiteIds.slice(index, index + 500))
          .gte('created_at', start)
          .order('id', { ascending: true })
          .range(from, to),
      );
      favorites.forEach((row) => pushEntry(row.site_id, { createdAt: row.created_at, score: 1 }));
    }
  }

  const communitySiteIds = communitySites.map((site) => site.id);
  for (let index = 0; index < communitySiteIds.length; index += 500) {
    const joins = await fetchPagedRows<{ site_id: string; approval_at: string }>((from, to) =>
      supabaseAdmin
        .from('rhizome_stigmas')
        .select('site_id, approval_at')
        .in('site_id', communitySiteIds.slice(index, index + 500))
        .eq('is_approval', true)
        .neq('role', 'owner')
        .gte('approval_at', start)
        .order('id', { ascending: true })
        .range(from, to),
    );
    joins.forEach((row) => pushEntry(row.site_id, { createdAt: row.approval_at, score: 1 }));
  }

  return entriesMap;
}

// 블로그는 좋아요+즐겨찾기, 커뮤니티는 새 가입자 수. 기간 안 점수 순으로 각각 정렬 후 번갈아 섞는다.
// 365일까지 넓혀도 limit개가 안 되면 점수가 있는 사이트만 노출
function rankRisingSites(sites: SiteRow[], entriesMap: Map<string, RisingEntry[]>, limit: number): SiteRow[] {
  const rankByType = (siteType: SiteRow['site_type'], start: string) =>
    sites
      .filter((site) => site.site_type === siteType)
      .map((site) => {
        const entries = (entriesMap.get(site.id) ?? []).filter((entry) => entry.createdAt >= start);
        return {
          site,
          score: entries.reduce((total, entry) => total + entry.score, 0),
          latestAt: entries.reduce((latest, entry) => (entry.createdAt > latest ? entry.createdAt : latest), ''),
        };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || right.latestAt.localeCompare(left.latestAt))
      .map((item) => item.site);

  let blogs: SiteRow[] = [];
  let communities: SiteRow[] = [];
  for (const days of PERIOD_DAYS) {
    const start = getDateBefore(days);
    blogs = rankByType('blog', start);
    communities = rankByType('community', start);
    if (blogs.length + communities.length >= limit) break;
  }

  const ranked: SiteRow[] = [];
  for (let index = 0; ranked.length < limit && (index < blogs.length || index < communities.length); index += 1) {
    if (index < blogs.length) ranked.push(blogs[index]);
    if (ranked.length < limit && index < communities.length) ranked.push(communities[index]);
  }

  return ranked;
}

async function toSiteHitCards(sites: SiteRow[]): Promise<MomentSiteHitCard[]> {
  const ownerIdsWithDomainFeature = await getUsersWithMembershipFeature(
    sites.map((site) => site.owner_id).filter((ownerId): ownerId is string => Boolean(ownerId)),
    'owner_domain',
  );

  return sites.map((site) => ({
    site_key: site.site_key,
    site_url: getPublicSiteUrl({
      siteKey: site.site_key,
      customDomain: site.custom_domain,
      hasOwnerDomainFeature: ownerIdsWithDomainFeature.has(site.owner_id ?? ''),
    }),
    site_label: site.site_label,
    summary: site.summary,
    site_type: site.site_type,
    created_at: '',
    profile_picture: toPublicUrl('avatar', site.profile_picture),
    profile_logo: toPublicUrl('profile_logo', site.profile_logo),
    promotion_image: toPublicUrl('promotion-image', site.promotion_image),
    member_count: site.member_count,
    post_count: site.post_count,
  }));
}

export async function getRisingMomentSites(limit = 20): Promise<MomentSiteHitCard[]> {
  const sites = await getMomentSitesForAudience('owner');
  if (!sites.length) return [];

  return toSiteHitCards(rankRisingSites(sites, await getSiteRisingEntries(sites), limit));
}

export type CategoryRisingSiteGroup = {
  id: number;
  label: string;
  categories: Array<{ id: number; label: string; sites: MomentSiteHitCard[] }>;
};

export async function getCategoryRisingSites(limit = 20): Promise<CategoryRisingSiteGroup[]> {
  const supabaseAdmin = getSupabaseAdmin();
  const sites = await fetchPagedRows<SiteRow>(
    (from, to) =>
      supabaseAdmin
        .from('rhizomes')
        .select(
          'id, owner_id, site_key, site_label, summary, site_type, profile_picture, profile_logo, promotion_image, custom_domain, member_count, post_count, category_id',
        )
        .not('category_id', 'is', null)
        .in('site_type', ['blog', 'community'])
        .eq('visibility_type', 'public')
        .eq('is_shutdown', false)
        .or('is_blocked.eq.false,is_blocked.is.null')
        .order('id', { ascending: true })
        .range(from, to),
    5000,
  );
  if (!sites.length) return [];

  const [entriesMap, categoryGroups] = await Promise.all([getSiteRisingEntries(sites), getSiteCategoryGroups()]);
  const sitesByCategory = new Map<number, SiteRow[]>();
  sites.forEach((site) => {
    const categoryId = site.category_id as number;
    const categorySites = sitesByCategory.get(categoryId) ?? [];
    categorySites.push(site);
    sitesByCategory.set(categoryId, categorySites);
  });

  const rankedByCategory = new Map<number, SiteRow[]>();
  sitesByCategory.forEach((categorySites, categoryId) => {
    const ranked = rankRisingSites(categorySites, entriesMap, limit);
    if (ranked.length) rankedByCategory.set(categoryId, ranked);
  });

  const cards = await toSiteHitCards([...rankedByCategory.values()].flat());
  const cardBySiteKey = new Map(cards.map((card) => [card.site_key, card]));

  return categoryGroups
    .map((group) => ({
      id: group.id,
      label: group.label,
      categories: group.categories
        .filter((category) => rankedByCategory.has(category.id))
        .map((category) => ({
          id: category.id,
          label: category.label,
          sites: (rankedByCategory.get(category.id) ?? [])
            .map((site) => cardBySiteKey.get(site.site_key))
            .filter((card): card is MomentSiteHitCard => Boolean(card)),
        })),
    }))
    .filter((group) => group.categories.length > 0);
}

export async function getTrendingMomentPosts(limit = 50, audience: Exclude<MomentAudience, 'all'> = 'creator') {
  return getRankedMomentPosts(limit, 'post_likes', audience);
}

export async function getMostReadMomentPosts(limit = 50, audience: Exclude<MomentAudience, 'all'> = 'creator') {
  return getRankedMomentPosts(limit, 'post_view_daily_stats', audience);
}
