import { getR2PublicUrl } from '@/lib/clients/r2Public';
import { r2Storage } from '@/lib/clients/r2Storage';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { getPostContentText } from '@/lib/reports/manage';
import { getAuthorState } from '@/lib/session/author';
import { normalizeText } from '@/lib/utils';

export type CreatorFollowingPost = {
  id: string;
  url: string;
  publishedAt: string | null;
  boardType: 'basic' | 'blog' | 'feed' | 'gallery' | 'youtube';
  content: string;
  image: string | null;
  youtubeId: string | null;
  creator: {
    activityName: string;
    handleName: string;
    profileImage: string | null;
  };
};

type PostImage = { path?: string | null };

function getContentExcerpt(value: string) {
  const content = normalizeText(value).replace(/\s+/g, ' ');
  const characters = Array.from(content);

  if (characters.length <= 127) return content;

  return `${characters.slice(0, 126).join('')}…`;
}

function getFirstImageUrl(value: unknown) {
  if (!Array.isArray(value)) return null;

  const path = normalizeText((value[0] as PostImage | undefined)?.path);
  return path ? getR2PublicUrl('post', path) : null;
}

export type CreatorFollowingTimeline = {
  owner: {
    id: string;
    activityName: string;
    handleName: string;
    profileImage: string | null;
    coverImage: string | null;
    introduction: string | null;
    links: Array<{ id: string; label: string; url: string }>;
    hasBranding: boolean;
    hasCreatorPosts: boolean;
    followingCount: number;
    followerCount: number;
  };
  posts: CreatorFollowingPost[];
};

type CreatorLibraryOwner = {
  id: string;
  activityName: string;
  handleName: string;
  profileImage: string | null;
  coverImage: string | null;
  introduction: string | null;
  links: Array<{ id: string; label: string; url: string }>;
  hasBranding: boolean;
  hasCreatorPosts: boolean;
  followingCount: number;
  followerCount: number;
};

export type CreatorFollowedLibraries = {
  owner: CreatorLibraryOwner;
  libraries: Array<{
    id: string;
    activityName: string;
    handleName: string;
    profileImage: string | null;
    introduction: string | null;
  }>;
  isOwner: boolean;
  canUseSeriesPosts: boolean;
  canUseCreatorLibrary: boolean;
  canFollowCreatorLibrary: boolean;
  viewerCreatorHandleName: string | null;
  isFollowing: boolean;
};

function getAvatarUrl(path: string | null) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return r2Storage.from('avatar').getPublicUrl(path).data.publicUrl ?? null;
}

function decryptUserName(value: string) {
  const text = normalizeText(value);
  if (!text) return null;
  try {
    const decrypted = decrypt(text);
    return decrypted.startsWith('naver_') ? null : decrypted;
  } catch {
    return null;
  }
}

export async function getCreatorFollowCounts(creatorId: string, userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const [followingResult, followerResult] = await Promise.all([
    supabaseAdmin.from('creator_follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
    supabaseAdmin.from('creator_follows').select('id', { count: 'exact', head: true }).eq('creator_id', creatorId),
  ]);

  if (followingResult.error || followerResult.error) throw new Error('작가 팔로우 정보를 불러오지 못했습니다.');

  return {
    followingCount: followingResult.count ?? 0,
    followerCount: followerResult.count ?? 0,
  };
}

export async function getCreatorFollowingTimeline(stigmaId: string): Promise<CreatorFollowingTimeline> {
  const supabaseAdmin = getSupabaseAdmin();
  const [followsResult, currentCreatorResult] = await Promise.all([
    supabaseAdmin.from('creator_follows').select('creator_id').eq('follower_id', stigmaId),
    supabaseAdmin
      .from('creators')
      .select('id, user_id, handle_name, cover_image, introduction')
      .eq('user_id', stigmaId)
      .maybeSingle(),
  ]);
  if (followsResult.error || currentCreatorResult.error) throw new Error('팔로우한 서재를 불러오지 못했습니다.');

  if (!currentCreatorResult.data) throw new Error('작가 프로필을 찾을 수 없습니다.');

  const { getMembershipFeatures } = await import('@/lib/memberships/features');
  const [membershipFeatures, ownerStigmaResult, ownerLinksResult, followCounts] = await Promise.all([
    getMembershipFeatures(stigmaId),
    supabaseAdmin.from('stigmas').select('user_name, avatar').eq('id', currentCreatorResult.data.user_id).maybeSingle(),
    supabaseAdmin
      .from('creator_links')
      .select('id, label, url')
      .eq('creator_id', currentCreatorResult.data.id)
      .order('sort_order'),
    getCreatorFollowCounts(currentCreatorResult.data.id, currentCreatorResult.data.user_id),
  ]);
  if (ownerStigmaResult.error || ownerLinksResult.error) throw new Error('작가 정보를 불러오지 못했습니다.');

  const hasBranding = membershipFeatures.has('creator_branding');

  const owner = {
    id: currentCreatorResult.data.id,
    activityName: decryptUserName(ownerStigmaResult.data?.user_name ?? '') ?? '작가',
    handleName: currentCreatorResult.data.handle_name,
    profileImage: getAvatarUrl(ownerStigmaResult.data?.avatar ?? null),
    coverImage: hasBranding ? currentCreatorResult.data.cover_image : null,
    introduction: hasBranding ? currentCreatorResult.data.introduction : null,
    links: hasBranding ? (ownerLinksResult.data ?? []) : [],
    hasBranding,
    hasCreatorPosts: membershipFeatures.has('creator_posts'),
    ...followCounts,
  };
  const creatorIds = (followsResult.data ?? []).map((follow) => follow.creator_id);
  if (!creatorIds.length) return { owner, posts: [] };

  const creatorsResult = await supabaseAdmin.from('creators').select('id, user_id, handle_name').in('id', creatorIds);
  if (creatorsResult.error) throw new Error('작가 정보를 불러오지 못했습니다.');

  const creators = creatorsResult.data ?? [];
  if (!creators.length) return { owner, posts: [] };

  const creatorUserIds = creators.map((creator) => creator.user_id);
  const postsResult = await supabaseAdmin
    .from('posts')
    .select(
      'id, site_id, board_id, slug, published_at, user_id, summary, content_html, content_markdown, content_simple, images, youtube_id, youtube_url',
    )
    .in('user_id', creatorUserIds)
    .eq('published_status', 'published')
    .eq('is_closed', false)
    .eq('is_wording_blinded', false)
    .order('published_at', { ascending: false })
    .range(0, 99);
  if (postsResult.error) throw new Error('글을 불러오지 못했습니다.');

  const posts = postsResult.data ?? [];
  const [stigmasResult, sitesResult, boardsResult] = await Promise.all([
    supabaseAdmin.from('stigmas').select('id, user_name, avatar').in('id', creatorUserIds),
    posts.length
      ? supabaseAdmin
          .from('rhizomes')
          .select('id, site_key')
          .in('id', [...new Set(posts.map((post) => post.site_id))])
      : { data: [], error: null },
    posts.length
      ? supabaseAdmin
          .from('boards')
          .select('id, board_key, board_type')
          .in('id', [...new Set(posts.map((post) => post.board_id))])
      : { data: [], error: null },
  ]);
  if (stigmasResult.error || sitesResult.error || boardsResult.error) throw new Error('글 정보를 불러오지 못했습니다.');

  const creatorByUserId = new Map(creators.map((creator) => [creator.user_id, creator]));
  const stigmaById = new Map((stigmasResult.data ?? []).map((stigma) => [stigma.id, stigma]));
  const siteById = new Map((sitesResult.data ?? []).map((site) => [site.id, site.site_key]));
  const boardById = new Map((boardsResult.data ?? []).map((board) => [board.id, board]));

  return {
    owner,
    posts: posts
      .map((post) => {
        const creator = creatorByUserId.get(post.user_id);
        const stigma = stigmaById.get(post.user_id);
        const board = boardById.get(post.board_id);
        const boardType = board?.board_type;

        if (!board || !['basic', 'blog', 'feed', 'gallery', 'youtube'].includes(boardType)) {
          return null;
        }

        return {
          id: post.id,
          publishedAt: post.published_at,
          url: `/${siteById.get(post.site_id) ?? ''}/${board.board_key}/${post.slug ?? ''}`,
          boardType,
          content: getContentExcerpt(
            getPostContentText({
              boardType,
              contentHtml: post.content_html,
              contentMarkdown: post.content_markdown,
              contentSimple: post.content_simple,
              summary: post.summary,
              youtubeUrl: null,
            }),
          ),
          image: boardType === 'gallery' ? getFirstImageUrl(post.images) : null,
          youtubeId: boardType === 'youtube' ? post.youtube_id : null,
          creator: {
            activityName: decryptUserName(stigma?.user_name ?? '') ?? '작가',
            handleName: creator?.handle_name ?? '',
            profileImage: getAvatarUrl(stigma?.avatar ?? null),
          },
        };
      })
      .filter((post): post is CreatorFollowingPost => post !== null),
  };
}

export async function getCreatorFollowedLibraries(
  handleName: string,
  viewerStigmaId: string | null,
): Promise<CreatorFollowedLibraries> {
  const supabaseAdmin = getSupabaseAdmin();
  const creatorResult = await supabaseAdmin
    .from('creators')
    .select('id, user_id, handle_name, cover_image, introduction')
    .eq('handle_name', normalizeText(handleName).toLowerCase())
    .maybeSingle();
  if (creatorResult.error || !creatorResult.data) throw new Error('작가 프로필을 찾을 수 없습니다.');

  const creator = creatorResult.data;
  const isOwner = viewerStigmaId === creator.user_id;
  const { getMembershipFeatures } = await import('@/lib/memberships/features');
  const [
    membershipFeatures,
    viewerMembershipFeatures,
    ownerStigmaResult,
    ownerLinksResult,
    followedResult,
    viewerAuthorState,
    viewerCreatorResult,
    followResult,
    followCounts,
  ] = await Promise.all([
    getMembershipFeatures(creator.user_id),
    viewerStigmaId && !isOwner ? getMembershipFeatures(viewerStigmaId) : Promise.resolve(null),
    supabaseAdmin.from('stigmas').select('user_name, avatar').eq('id', creator.user_id).maybeSingle(),
    supabaseAdmin.from('creator_links').select('id, label, url').eq('creator_id', creator.id).order('sort_order'),
    supabaseAdmin.from('creator_follows').select('creator_id').eq('follower_id', creator.user_id),
    viewerStigmaId ? getAuthorState(viewerStigmaId) : Promise.resolve({ isAuthor: false }),
    viewerStigmaId && !isOwner
      ? supabaseAdmin.from('creators').select('handle_name').eq('user_id', viewerStigmaId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    viewerStigmaId && !isOwner
      ? supabaseAdmin
          .from('creator_follows')
          .select('id')
          .eq('follower_id', viewerStigmaId)
          .eq('creator_id', creator.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    getCreatorFollowCounts(creator.id, creator.user_id),
  ]);
  if (
    ownerStigmaResult.error ||
    ownerLinksResult.error ||
    followedResult.error ||
    viewerCreatorResult.error ||
    followResult.error
  ) {
    throw new Error('작가 정보를 불러오지 못했습니다.');
  }

  const hasBranding = membershipFeatures.has('creator_branding');
  const canUseSeriesPosts =
    membershipFeatures.has('creator_posts') || viewerMembershipFeatures?.has('creator_posts') === true;
  const owner: CreatorLibraryOwner = {
    id: creator.id,
    activityName: decryptUserName(ownerStigmaResult.data?.user_name ?? '') ?? '작가',
    handleName: creator.handle_name,
    profileImage: getAvatarUrl(ownerStigmaResult.data?.avatar ?? null),
    coverImage: hasBranding ? creator.cover_image : null,
    introduction: hasBranding ? creator.introduction : null,
    links: hasBranding ? (ownerLinksResult.data ?? []) : [],
    hasBranding,
    hasCreatorPosts: membershipFeatures.has('creator_posts'),
    ...followCounts,
  };
  const followedCreatorIds = (followedResult.data ?? []).map((follow) => follow.creator_id);
  if (!followedCreatorIds.length) {
    return {
      owner,
      libraries: [],
      isOwner,
      canUseSeriesPosts,
      canUseCreatorLibrary: viewerAuthorState.isAuthor,
      canFollowCreatorLibrary: viewerAuthorState.isAuthor || viewerMembershipFeatures?.has('affetto_my_posts') === true,
      viewerCreatorHandleName: viewerAuthorState.isAuthor ? (viewerCreatorResult.data?.handle_name ?? null) : null,
      isFollowing: Boolean(followResult.data),
    };
  }

  const followedCreatorsResult = await supabaseAdmin
    .from('creators')
    .select('id, user_id, handle_name, introduction')
    .in('id', followedCreatorIds);
  if (followedCreatorsResult.error) throw new Error('팔로잉한 서재를 불러오지 못했습니다.');

  const followedCreators = followedCreatorsResult.data ?? [];
  const followedUserIds = followedCreators.map((followedCreator) => followedCreator.user_id);
  const followedStigmasResult = followedUserIds.length
    ? await supabaseAdmin.from('stigmas').select('id, user_name, avatar').in('id', followedUserIds)
    : { data: [], error: null };
  if (followedStigmasResult.error) throw new Error('팔로잉한 서재를 불러오지 못했습니다.');

  const creatorById = new Map(followedCreators.map((followedCreator) => [followedCreator.id, followedCreator]));
  const stigmaById = new Map((followedStigmasResult.data ?? []).map((stigma) => [stigma.id, stigma]));
  const libraries = followedCreatorIds.flatMap((creatorId) => {
    const followedCreator = creatorById.get(creatorId);
    if (!followedCreator) return [];
    const stigma = stigmaById.get(followedCreator.user_id);
    return [
      {
        id: followedCreator.id,
        activityName: decryptUserName(stigma?.user_name ?? '') ?? '작가',
        handleName: followedCreator.handle_name,
        profileImage: getAvatarUrl(stigma?.avatar ?? null),
        introduction: followedCreator.introduction,
      },
    ];
  });

  return {
    owner,
    libraries,
    isOwner,
    canUseSeriesPosts,
    canUseCreatorLibrary: viewerAuthorState.isAuthor,
    canFollowCreatorLibrary: viewerAuthorState.isAuthor || viewerMembershipFeatures?.has('affetto_my_posts') === true,
    viewerCreatorHandleName: viewerAuthorState.isAuthor ? (viewerCreatorResult.data?.handle_name ?? null) : null,
    isFollowing: Boolean(followResult.data),
  };
}
