import { NextResponse } from 'next/server';
import { getR2PublicUrl } from '@/lib/clients/r2Public';
import { r2Storage } from '@/lib/clients/r2Storage';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { getMembershipFeatures } from '@/lib/memberships/features';
import { getPostContentText } from '@/lib/reports/manage';
import { getAuthorState } from '@/lib/session/author';
import { getCurrentStigma } from '@/lib/session/utils';
import { normalizeText } from '@/lib/utils';

type CreatorBoardType = 'basic' | 'blog' | 'feed' | 'gallery' | 'youtube';
type PostImage = { path?: string | null };

function isCreatorBoardType(value: string | null): value is CreatorBoardType {
  return value === 'basic' || value === 'blog' || value === 'feed' || value === 'gallery' || value === 'youtube';
}

function getContentExcerpt(value: string) {
  const content = normalizeText(value).replace(/\s+/g, ' ');
  const characters = Array.from(content);

  if (characters.length <= 127) return content;

  return `${characters.slice(0, 126).join('')}…`;
}

function getFirstImageSize(value: unknown): { imageWidth: number | null; imageHeight: number | null } {
  const image =
    Array.isArray(value) && value[0] && typeof value[0] === 'object' ? (value[0] as Record<string, unknown>) : null;
  const width = Number(image?.width);
  const height = Number(image?.height);

  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
    ? { imageWidth: width, imageHeight: height }
    : { imageWidth: null, imageHeight: null };
}

function getFirstImageUrl(value: unknown) {
  if (!Array.isArray(value)) return null;

  const path = normalizeText((value[0] as PostImage | undefined)?.path);
  return path ? getR2PublicUrl('post', path) : null;
}

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

export async function GET(_: Request, context: { params: Promise<{ handleName: string }> }) {
  const { handleName } = await context.params;
  const normalizedHandleName = handleName.trim().toLowerCase();
  const supabaseAdmin = getSupabaseAdmin();
  const profileResult = await supabaseAdmin
    .from('users')
    .select('id, user_id, handle_name, cover_image, introduction')
    .eq('handle_name', normalizedHandleName)
    .maybeSingle();
  if (profileResult.error) return NextResponse.json({ message: '독자 프로필을 불러오지 못했습니다.' }, { status: 500 });
  if (!profileResult.data) return NextResponse.json({ message: '독자 프로필을 찾을 수 없습니다.' }, { status: 404 });

  const page = Math.max(1, Number(new URL(_.url).searchParams.get('page') ?? '1') || 1);
  const from = (page - 1) * 100;
  const creator = profileResult.data;

  const [currentStigma, stigmaResult, seriesResult, features, creatorProfileResult, authorState] = await Promise.all([
    getCurrentStigma(),
    supabaseAdmin.from('stigmas').select('user_name, avatar').eq('id', creator.user_id).maybeSingle(),
    supabaseAdmin.from('board_series').select('id, series_label').eq('user_id', creator.user_id),
    getMembershipFeatures(creator.user_id),
    supabaseAdmin.from('creators').select('id').eq('user_id', creator.user_id).maybeSingle(),
    getAuthorState(creator.user_id),
  ]);

  if (!features.has('affetto_my_posts')) {
    return NextResponse.json({ message: '개인사정으로 인해 운영이 중단되었습니다.' }, { status: 403 });
  }

  if (stigmaResult.error || seriesResult.error || creatorProfileResult.error)
    return NextResponse.json({ message: '독자 정보를 불러오지 못했습니다.' }, { status: 500 });

  if (creatorProfileResult.data && authorState.isAuthor && features.has('creator_lounge')) {
    const creatorProfile = creatorProfileResult.data;
    const followsResult = await supabaseAdmin
      .from('creator_follows')
      .select('creator_id')
      .eq('follower_id', creator.user_id);
    if (followsResult.error) {
      return NextResponse.json({ message: '작가의 서재 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const followedCreatorIds = (followsResult.data ?? []).map((follow) => follow.creator_id);
    const creatorIds = [...new Set([creatorProfile.id, ...followedCreatorIds])];
    const creatorsResult = await supabaseAdmin.from('creators').select('id, user_id, handle_name').in('id', creatorIds);
    if (creatorsResult.error) {
      return NextResponse.json({ message: '작가의 서재 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const followedCreators = creatorsResult.data ?? [];
    const creatorUserIds = followedCreators.map((followedCreator) => followedCreator.user_id);
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
    if (postsResult.error) {
      return NextResponse.json({ message: '글을 불러오지 못했습니다.' }, { status: 500 });
    }

    const timelinePosts = postsResult.data ?? [];
    const [stigmasResult, sitesResult, boardsResult] = await Promise.all([
      supabaseAdmin.from('stigmas').select('id, user_name, avatar').in('id', creatorUserIds),
      timelinePosts.length
        ? supabaseAdmin
            .from('rhizomes')
            .select('id, site_key')
            .in('id', [...new Set(timelinePosts.map((post) => post.site_id))])
        : { data: [], error: null },
      timelinePosts.length
        ? supabaseAdmin
            .from('boards')
            .select('id, board_key, board_type')
            .in('id', [...new Set(timelinePosts.map((post) => post.board_id))])
        : { data: [], error: null },
    ]);
    if (stigmasResult.error || sitesResult.error || boardsResult.error) {
      return NextResponse.json({ message: '글 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const creatorByUserId = new Map(
      followedCreators.map((followedCreator) => [followedCreator.user_id, followedCreator]),
    );
    const stigmaById = new Map((stigmasResult.data ?? []).map((stigma) => [stigma.id, stigma]));
    const siteById = new Map((sitesResult.data ?? []).map((site) => [site.id, site.site_key]));
    const boardById = new Map((boardsResult.data ?? []).map((board) => [board.id, board]));
    return NextResponse.json({
      libraryType: 'creator',
      user: {
        handleName: creator.handle_name,
        coverImage: creator.cover_image,
        introduction: creator.introduction,
        activityName: decryptUserName(stigmaResult.data?.user_name ?? '') ?? '작가',
        profileImage: getAvatarUrl(stigmaResult.data?.avatar ?? null),
      },
      posts: timelinePosts.flatMap((post) => {
        const postCreator = creatorByUserId.get(post.user_id);
        const stigma = stigmaById.get(post.user_id);
        const board = boardById.get(post.board_id);
        const boardType = board?.board_type;

        if (!postCreator || !board || !isCreatorBoardType(boardType)) return [];

        return [
          {
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
            ...(boardType === 'gallery' ? getFirstImageSize(post.images) : { imageWidth: null, imageHeight: null }),
            youtubeId: boardType === 'youtube' ? post.youtube_id : null,
            creator: {
              activityName: decryptUserName(stigma?.user_name ?? '') ?? '작가',
              handleName: postCreator.handle_name,
              profileImage: getAvatarUrl(stigma?.avatar ?? null),
            },
          },
        ];
      }),
      total: timelinePosts.length,
      page: 1,
      isOwner: currentStigma?.stigmaId === creator.user_id,
    });
  }

  const series = seriesResult.data ?? [];
  const isOwner = currentStigma?.stigmaId === creator.user_id;
  const requestedTab = new URL(_.url).searchParams.get('tab') === 'following' ? 'following' : 'all';
  const followsResult = await supabaseAdmin
    .from('creator_follows')
    .select('creator_id')
    .eq('follower_id', creator.user_id);
  if (followsResult.error) {
    return NextResponse.json({ message: '팔로우한 작가의 서재를 불러오지 못했습니다.' }, { status: 500 });
  }

  const followedCreatorIds = (followsResult.data ?? []).map((follow) => follow.creator_id);
  const followedCreatorsResult = followedCreatorIds.length
    ? await supabaseAdmin.from('creators').select('id, user_id, handle_name, introduction').in('id', followedCreatorIds)
    : { data: [], error: null };
  if (followedCreatorsResult.error) {
    return NextResponse.json({ message: '팔로우한 작가의 서재를 불러오지 못했습니다.' }, { status: 500 });
  }

  const followedCreators = followedCreatorsResult.data ?? [];
  const followedUserIds = followedCreators.map((followedCreator) => followedCreator.user_id);
  const followedStigmasResult = followedUserIds.length
    ? await supabaseAdmin.from('stigmas').select('id, user_name, avatar').in('id', followedUserIds)
    : { data: [], error: null };
  if (followedStigmasResult.error) {
    return NextResponse.json({ message: '팔로우한 작가의 서재를 불러오지 못했습니다.' }, { status: 500 });
  }

  const followedCreatorById = new Map(followedCreators.map((followedCreator) => [followedCreator.id, followedCreator]));
  const followedStigmaById = new Map((followedStigmasResult.data ?? []).map((stigma) => [stigma.id, stigma]));
  const followingLibraries = followedCreatorIds.flatMap((creatorId) => {
    const followedCreator = followedCreatorById.get(creatorId);
    if (!followedCreator) return [];
    const stigma = followedStigmaById.get(followedCreator.user_id);
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
  const hasFollowingLibraries = followingLibraries.length > 0;
  const tab = hasFollowingLibraries ? requestedTab : 'all';

  if (tab === 'following') {
    if (!isOwner) {
      return NextResponse.json({
        user: {
          handleName: creator.handle_name,
          coverImage: creator.cover_image,
          introduction: creator.introduction,
          activityName: decryptUserName(stigmaResult.data?.user_name ?? '') ?? '독자',
          profileImage: getAvatarUrl(stigmaResult.data?.avatar ?? null),
        },
        posts: [],
        followingPosts: [],
        followingLibraries,
        hasFollowingLibraries,
        tab,
        total: 0,
        page: 1,
        isOwner,
      });
    }

    const followingPostsResult = await supabaseAdmin
      .from('posts')
      .select(
        'id, site_id, board_id, slug, published_at, user_id, summary, content_html, content_markdown, content_simple, images, youtube_id',
      )
      .in('user_id', followedUserIds)
      .eq('published_status', 'published')
      .eq('is_closed', false)
      .eq('is_wording_blinded', false)
      .order('published_at', { ascending: false })
      .range(0, 99);
    if (followingPostsResult.error) {
      return NextResponse.json({ message: '팔로우한 작가의 글을 불러오지 못했습니다.' }, { status: 500 });
    }

    const followingPosts = followingPostsResult.data ?? [];
    const [followingSitesResult, followingBoardsResult] = await Promise.all([
      followingPosts.length
        ? supabaseAdmin
            .from('rhizomes')
            .select('id, site_key')
            .in('id', [...new Set(followingPosts.map((post) => post.site_id))])
        : { data: [], error: null },
      followingPosts.length
        ? supabaseAdmin
            .from('boards')
            .select('id, board_key, board_type')
            .in('id', [...new Set(followingPosts.map((post) => post.board_id))])
        : { data: [], error: null },
    ]);
    if (followingSitesResult.error || followingBoardsResult.error) {
      return NextResponse.json({ message: '팔로우한 작가의 글 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const followingCreatorByUserId = new Map(
      followedCreators.map((followedCreator) => [followedCreator.user_id, followedCreator]),
    );
    const followingSiteById = new Map((followingSitesResult.data ?? []).map((site) => [site.id, site.site_key]));
    const followingBoardById = new Map((followingBoardsResult.data ?? []).map((board) => [board.id, board]));
    return NextResponse.json({
      user: {
        handleName: creator.handle_name,
        coverImage: creator.cover_image,
        introduction: creator.introduction,
        activityName: decryptUserName(stigmaResult.data?.user_name ?? '') ?? '독자',
        profileImage: getAvatarUrl(stigmaResult.data?.avatar ?? null),
      },
      posts: [],
      followingPosts: followingPosts.flatMap((post) => {
        const postCreator = followingCreatorByUserId.get(post.user_id);
        const stigma = followedStigmaById.get(post.user_id);
        const board = followingBoardById.get(post.board_id);
        const boardType = board?.board_type;
        if (!postCreator || !board || !isCreatorBoardType(boardType)) return [];

        return [
          {
            id: post.id,
            publishedAt: post.published_at,
            url: `/${followingSiteById.get(post.site_id) ?? ''}/${board.board_key}/${post.slug ?? ''}`,
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
            ...(boardType === 'gallery' ? getFirstImageSize(post.images) : { imageWidth: null, imageHeight: null }),
            youtubeId: boardType === 'youtube' ? post.youtube_id : null,
            creator: {
              activityName: decryptUserName(stigma?.user_name ?? '') ?? '작가',
              handleName: postCreator.handle_name,
              profileImage: getAvatarUrl(stigma?.avatar ?? null),
            },
          },
        ];
      }),
      followingLibraries,
      hasFollowingLibraries,
      tab,
      total: followingPosts.length,
      page: 1,
      isOwner,
    });
  }

  let postsQuery = supabaseAdmin
    .from('posts')
    .select('id, site_id, board_id, series_id, subject, slug, published_at', { count: 'exact' })
    .eq('user_id', creator.user_id)
    .eq('published_status', 'published')
    .eq('is_closed', false);

  postsQuery = currentStigma?.stigmaId
    ? postsQuery.or(`is_wording_blinded.eq.false,user_id.eq.${currentStigma.stigmaId}`)
    : postsQuery.eq('is_wording_blinded', false);

  const postsResult = await postsQuery.order('published_at', { ascending: false }).range(from, from + 99);

  if (postsResult.error)
    return NextResponse.json(
      { message: '독자 서재의 글 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    );

  const posts = postsResult.data ?? [];
  const [sitesResult, boardsResult] = await Promise.all([
    posts.length
      ? supabaseAdmin
          .from('rhizomes')
          .select('id, site_key, site_label')
          .in('id', [...new Set(posts.map((post) => post.site_id))])
      : { data: [], error: null },
    posts.length
      ? supabaseAdmin
          .from('boards')
          .select('id, board_key')
          .in('id', [...new Set(posts.map((post) => post.board_id))])
      : { data: [], error: null },
  ]);
  if (sitesResult.error || boardsResult.error)
    return NextResponse.json({ message: '연재글 경로를 불러오지 못했습니다.' }, { status: 500 });
  const siteMap = new Map(
    (sitesResult.data ?? []).map((site) => [site.id, { key: site.site_key, label: site.site_label }]),
  );
  const boardMap = new Map((boardsResult.data ?? []).map((board) => [board.id, board.board_key]));
  const seriesMap = new Map(series.map((item) => [item.id, item.series_label]));

  return NextResponse.json({
    user: {
      handleName: creator.handle_name,
      coverImage: creator.cover_image,
      introduction: creator.introduction,
      activityName: decryptUserName(stigmaResult.data?.user_name ?? '') ?? '독자',
      profileImage: getAvatarUrl(stigmaResult.data?.avatar ?? null),
    },
    posts: posts.map((post) => ({
      id: post.id,
      subject: post.subject ?? '제목 없음',
      publishedAt: post.published_at,
      seriesLabel: seriesMap.get(post.series_id) ?? '연재',
      siteLabel: siteMap.get(post.site_id)?.label ?? '사이트',
      url: `/${siteMap.get(post.site_id)?.key ?? ''}/${boardMap.get(post.board_id) ?? ''}/${post.slug ?? ''}`,
    })),
    followingPosts: [],
    followingLibraries,
    hasFollowingLibraries,
    tab,
    total: postsResult.count ?? 0,
    page,
    isOwner,
  });
}
