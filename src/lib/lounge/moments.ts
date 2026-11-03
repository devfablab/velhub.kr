import { cache } from 'react';
import { decrypt } from '@/lib/encryption/decrypt';
import { isMinor } from '@/lib/identity/age';
import { getChorogonBirthDate } from '@/lib/identity/chorogon';
import { getUsersWithMembershipFeature } from '@/lib/memberships/features';
import { r2Storage } from '@/lib/r2Storage';
import { getPublicSiteUrl } from '@/lib/siteUrl';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

const PERIOD_DAYS = [1, 3, 5, 7, 15, 27, 50, 70, 90, 120, 150, 170, 200, 230, 250, 270, 300, 330, 365];

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
};

type BoardRow = {
  id: string;
  site_id: string;
  board_key: string;
  board_type: 'basic' | 'blog' | 'feed' | 'gallery' | 'youtube';
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
  images: Array<{ path?: string }> | null;
  thumbnail_image: string | null;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
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
  thumbnail_image?: string | null;
  thumbnail_width?: number | null;
  thumbnail_height?: number | null;
  youtube_id?: string | null;
};

function getDateBefore(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function toPublicUrl(bucket: string, path: string | null | undefined) {
  const normalizedPath = normalizeText(path);
  if (!normalizedPath) return null;
  if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) return normalizedPath;
  return r2Storage.from(bucket).getPublicUrl(normalizedPath).data.publicUrl ?? null;
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
  const creatorsResult = await supabaseAdmin
    .from('creators')
    .select('id, user_id, handle_name, cover_image, introduction, created_at');

  if (creatorsResult.error) throw creatorsResult.error;
  const creatorRows = (creatorsResult.data ?? []) as CreatorRow[];
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

export async function getNewMomentSites(limit = 20, momentOnly = true): Promise<MomentSiteCard[]> {
  const creatorUserIds = momentOnly ? (await getMomentCreators()).map((creator) => creator.userId) : [];
  if (momentOnly && creatorUserIds.length === 0) return [];

  const supabaseAdmin = getSupabaseAdmin();
  let sitesQuery = supabaseAdmin
    .from('rhizomes')
    .select('id, owner_id, site_key, site_label, summary, site_type, profile_picture, promotion_image, custom_domain')
    .in('site_type', ['blog', 'community'])
    .eq('visibility_type', 'public')
    .eq('is_shutdown', false)
    .or('is_blocked.eq.false,is_blocked.is.null');
  if (momentOnly) sitesQuery = sitesQuery.in('owner_id', creatorUserIds);
  const sitesResult = await sitesQuery.limit(5000);

  if (sitesResult.error) throw sitesResult.error;
  const sites = (sitesResult.data ?? []) as SiteRow[];
  if (sites.length === 0) return [];

  const postsResult = await supabaseAdmin
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
    .limit(10000);

  if (postsResult.error) throw postsResult.error;
  const firstPublishedAtBySiteId = new Map<string, string>();
  (postsResult.data ?? []).forEach((post) => {
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
  const followsResult = await supabaseAdmin
    .from('creator_follows')
    .select('creator_id, created_at')
    .in('creator_id', creatorIds)
    .order('created_at', { ascending: false })
    .limit(10000);

  if (followsResult.error) throw followsResult.error;
  const follows = followsResult.data ?? [];
  const creatorById = new Map(creators.map((creator) => [creator.id, creator]));

  for (const days of PERIOD_DAYS) {
    const start = getDateBefore(days);
    const countByCreatorId = new Map<string, number>();
    follows.forEach((follow) => {
      if (follow.created_at >= start)
        countByCreatorId.set(follow.creator_id, (countByCreatorId.get(follow.creator_id) ?? 0) + 1);
    });
    const ranked = [...countByCreatorId.entries()]
      .flatMap(([creatorId, count]) => {
        const creator = creatorById.get(creatorId);
        return creator ? [{ creator, count }] : [];
      })
      .sort((left, right) => right.count - left.count || right.creator.createdAt.localeCompare(left.creator.createdAt));
    if (ranked.length >= limit) {
      return ranked.slice(0, limit).map(({ creator }) => ({
        handleName: creator.handleName,
        activityName: creator.activityName,
        profileImage: creator.profileImage,
        coverImage: creator.coverImage,
        introduction: creator.introduction,
        createdAt: creator.createdAt,
      }));
    }
  }

  const followedCreatorIds = new Set(follows.map((follow) => follow.creator_id));
  return creators
    .filter((creator) => followedCreatorIds.has(creator.id))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .concat(
      creators
        .filter((creator) => !followedCreatorIds.has(creator.id))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    )
    .slice(0, limit)
    .map((creator) => ({
      handleName: creator.handleName,
      activityName: creator.activityName,
      profileImage: creator.profileImage,
      coverImage: creator.coverImage,
      introduction: creator.introduction,
      createdAt: creator.createdAt,
    }));
}

const getMomentPosts = cache(async (): Promise<{ posts: MomentPostCard[]; sourceRows: MomentPostRow[] }> => {
  const creators = await getMomentCreators();
  const creatorByUserId = new Map(creators.map((creator) => [creator.userId, creator]));
  const userIds = [...creatorByUserId.keys()];
  if (userIds.length === 0) return { posts: [], sourceRows: [] };

  const supabaseAdmin = getSupabaseAdmin();
  const postsResult = await supabaseAdmin
    .from('posts')
    .select(
      'id, site_id, board_id, user_id, slug, subject, summary, content_html, content_simple, images, thumbnail_image, thumbnail_width, thumbnail_height, youtube_id, youtube_url, published_at, series_id',
    )
    .in('user_id', userIds)
    .eq('published_status', 'published')
    .eq('is_closed', false)
    .eq('is_wording_blinded', false)
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(5000);

  if (postsResult.error) throw postsResult.error;
  const postRows = (postsResult.data ?? []) as MomentPostRow[];
  if (postRows.length === 0) return { posts: [], sourceRows: [] };

  const boardIds = [...new Set(postRows.map((post) => post.board_id))];
  const boardsResult = await supabaseAdmin
    .from('boards')
    .select('id, site_id, board_key, board_type')
    .in('id', boardIds)
    .in('board_type', ['basic', 'blog', 'feed', 'gallery', 'youtube']);

  if (boardsResult.error) throw boardsResult.error;
  const boardById = new Map(((boardsResult.data ?? []) as BoardRow[]).map((board) => [board.id, board]));
  const siteIds = [...new Set([...boardById.values()].map((board) => board.site_id))];
  if (siteIds.length === 0) return { posts: [], sourceRows: [] };

  const sitesResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, owner_id, site_key, site_label, summary, site_type, profile_picture, promotion_image, custom_domain')
    .in('id', siteIds)
    .in('site_type', ['blog', 'community'])
    .eq('visibility_type', 'public')
    .eq('is_shutdown', false)
    .or('is_blocked.eq.false,is_blocked.is.null');

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
    return site.site_type === 'blog' || Boolean(post.series_id);
  });

  const posts: MomentPostCard[] = resolvedRows.flatMap<MomentPostCard>((post): MomentPostCard[] => {
    const board = boardById.get(post.board_id);
    const site = board ? siteById.get(board.site_id) : null;
    const creator = creatorByUserId.get(post.user_id);
    if (!board || !site || !creator) return [];

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
      author_name: creator.activityName,
      author_avatar: creator.profileImage,
      published_at: post.published_at,
    };

    if (board.board_type === 'gallery') {
      return [
        {
          ...base,
          subject: post.subject,
          summary: post.summary,
          content_html: post.content_html,
          image: Array.isArray(post.images) ? toPublicUrl('post', post.images[0]?.path) : null,
        },
      ];
    }

    if (board.board_type === 'youtube') {
      return [
        {
          ...base,
          subject: post.subject,
          summary: post.summary,
          thumbnail_image: toPublicUrl('post', post.thumbnail_image),
          thumbnail_width: post.thumbnail_width,
          thumbnail_height: post.thumbnail_height,
          youtube_id: post.youtube_id,
        },
      ];
    }

    if (board.board_type === 'feed') {
      return [
        {
          ...base,
          content_simple: post.content_simple,
          image: Array.isArray(post.images) ? toPublicUrl('post', post.images[0]?.path) : null,
        },
      ];
    }

    return [
      {
        ...base,
        subject: post.subject,
        content_html: post.content_html,
        thumbnail_image: toPublicUrl('post', post.thumbnail_image),
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
});

function getPostKey(post: MomentPostCard) {
  return `${post.site_key}:${post.board_key}:${post.slug}`;
}

export async function getRecentMomentPosts(limit = 50): Promise<MomentPostCard[]> {
  const { posts } = await getMomentPosts();
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
      const result = await supabaseAdmin
        .from('post_likes')
        .select('post_id, created_at')
        .in('post_id', postIdChunk)
        .gte('created_at', start);
      if (result.error) throw result.error;
      (result.data ?? []).forEach((row) => {
        const rows = scoreMap.get(row.post_id) ?? [];
        rows.push({ createdAt: row.created_at, score: 1 });
        scoreMap.set(row.post_id, rows);
      });
      continue;
    }

    const result = await supabaseAdmin
      .from('post_view_daily_stats')
      .select('post_id, view_date, view_count')
      .in('post_id', postIdChunk)
      .gte('view_date', start.slice(0, 10));
    if (result.error) throw result.error;
    (result.data ?? []).forEach((row) => {
      const rows = scoreMap.get(row.post_id) ?? [];
      rows.push({ createdAt: `${row.view_date}T00:00:00.000Z`, score: Number(row.view_count ?? 0) });
      scoreMap.set(row.post_id, rows);
    });
  }

  return scoreMap;
}

async function getRankedMomentPosts(limit: number, table: 'post_likes' | 'post_view_daily_stats') {
  const { posts } = await getMomentPosts();
  const postById = new Map(posts.map((post) => [post.post_id, post]));
  const scoreMap = await getPostScoreMap([...postById.keys()], table);

  for (const days of PERIOD_DAYS) {
    const start = getDateBefore(days);
    const ranked = [...postById.entries()]
      .map(([postId, post]) => ({
        post,
        score: (scoreMap.get(postId) ?? [])
          .filter((entry) => entry.createdAt >= start)
          .reduce((total, entry) => total + entry.score, 0),
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || right.post.published_at.localeCompare(left.post.published_at));
    if (ranked.length >= limit) return ranked.slice(0, limit).map((item) => item.post);
  }

  const ranked = [...postById.entries()]
    .map(([postId, post]) => ({
      post,
      score: (scoreMap.get(postId) ?? []).reduce((total, entry) => total + entry.score, 0),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || right.post.published_at.localeCompare(left.post.published_at))
    .map((item) => item.post);
  const fallback = posts
    .filter((post) => !ranked.some((rankedPost) => getPostKey(rankedPost) === getPostKey(post)))
    .sort((left, right) => right.published_at.localeCompare(left.published_at));
  return [...ranked, ...fallback].slice(0, limit);
}

export async function getTrendingMomentPosts(limit = 50) {
  return getRankedMomentPosts(limit, 'post_likes');
}

export async function getMostReadMomentPosts(limit = 50) {
  return getRankedMomentPosts(limit, 'post_view_daily_stats');
}
