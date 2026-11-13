import { AUTO_OG_IMAGE_HEIGHT, AUTO_OG_IMAGE_WIDTH, getAutoOgImageUrl } from '@/lib/board/postThumbnail';
import { r2Storage } from '@/lib/clients/r2Storage';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { getCoAuthorNamesByPostIds } from '@/lib/service/blog/coPosts';
import { normalizeText } from '@/lib/utils';

type SiteType = 'blog' | 'community';
type BoardType = 'basic' | 'blog' | 'feed' | 'gallery' | 'youtube';

type StoredPost = {
  id: string;
  slug: number | string;
  subject: string | null;
  summary: string | null;
  content_html: string | null;
  content_simple: string | null;
  images: unknown;
  thumbnail_image: string | null;
  thumbnail_width: number | string | null;
  thumbnail_height: number | string | null;
  auto_og_image: string | null;
  youtube_id: string | null;
  youtube_url: string | null;
  published_at: string | null;
  post_count: number | null;
  user_id: string | null;
  site_id: string;
  board_id: string;
  published_status: string;
  is_closed: boolean;
};

export type HubPostDisplay = {
  id: string;
  href: string;
  siteType: SiteType;
  siteName: string;
  siteImage: string | null;
  boardType: BoardType;
  authorName: string;
  authorImage: string | null;
  publishedAt: string | null;
  postCount: number | null;
  subject: string;
  summary: string | null;
  contentHtml: string | null;
  contentSimple: string | null;
  thumbnailImage: string | null;
  thumbnailWidth: number | null;
  thumbnailHeight: number | null;
  image: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  youtubeId: string | null;
  isClosed: boolean;
  isPublished: boolean;
};

type ImageValue = { path?: unknown; width?: unknown; height?: unknown };

function decryptValue(value: string | null) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) return '';

  try {
    return decrypt(normalizedValue);
  } catch {
    return '';
  }
}

function getPublicImageUrl(bucket: string, path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) return null;

  if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) return normalizedPath;

  return r2Storage.from(bucket).getPublicUrl(normalizedPath).data.publicUrl || null;
}

function getListThumbnail(
  post: Pick<StoredPost, 'thumbnail_image' | 'thumbnail_width' | 'thumbnail_height' | 'auto_og_image'>,
) {
  const thumbnailImage = getPostThumbnailImageUrl(post.thumbnail_image);

  if (thumbnailImage) {
    return {
      thumbnailImage,
      thumbnailWidth: toImageDimension(post.thumbnail_width),
      thumbnailHeight: toImageDimension(post.thumbnail_height),
    };
  }

  const autoOgImage = getAutoOgImageUrl(post.auto_og_image);

  return {
    thumbnailImage: autoOgImage || null,
    thumbnailWidth: autoOgImage ? AUTO_OG_IMAGE_WIDTH : null,
    thumbnailHeight: autoOgImage ? AUTO_OG_IMAGE_HEIGHT : null,
  };
}

function getPostThumbnailImageUrl(path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) return null;

  return getPublicImageUrl(normalizedPath.includes('/') ? 'post' : 'og-image', normalizedPath);
}

function toImageDimension(value: unknown) {
  const dimension = typeof value === 'string' ? Number(value) : value;
  return typeof dimension === 'number' && Number.isFinite(dimension) && dimension > 0 ? dimension : null;
}

function getFirstPostImage(images: unknown) {
  const image = Array.isArray(images)
    ? images.find((value): value is ImageValue => Boolean(value) && typeof value === 'object')
    : null;
  const path = image && typeof image.path === 'string' ? image.path : null;

  return {
    url: getPublicImageUrl('post', path),
    width: toImageDimension(image?.width),
    height: toImageDimension(image?.height),
  };
}

function extractYoutubeId(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);
  const matched = normalizedValue.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&#/]+)/i);

  return matched?.[1] ?? null;
}

export async function getHubPostDisplayMap({
  postIds,
  siteType,
  viewerStigmaId,
}: {
  postIds: string[];
  siteType: SiteType;
  viewerStigmaId: string | null;
}) {
  const uniquePostIds = Array.from(new Set(postIds.filter(Boolean)));
  const result = new Map<string, HubPostDisplay>();

  if (uniquePostIds.length === 0) return result;

  const supabaseAdmin = getSupabaseAdmin();
  const postsResult = await supabaseAdmin
    .from('posts')
    .select(
      'id, slug, subject, summary, content_html, content_simple, images, thumbnail_image, thumbnail_width, thumbnail_height, auto_og_image, youtube_id, youtube_url, published_at, post_count, user_id, site_id, board_id, published_status, is_closed',
    )
    .in('id', uniquePostIds)
    .or(`is_wording_blinded.eq.false,user_id.eq.${viewerStigmaId ?? ''}`);

  if (postsResult.error) throw new Error('글 정보를 불러오지 못했습니다.');

  const posts = (postsResult.data ?? []) as StoredPost[];
  const boardIds = Array.from(new Set(posts.map((post) => post.board_id)));
  const siteIds = Array.from(new Set(posts.map((post) => post.site_id)));

  const [boardsResult, sitesResult] = await Promise.all([
    boardIds.length > 0
      ? supabaseAdmin.from('boards').select('id, board_key, board_type, site_id').in('id', boardIds)
      : { data: [], error: null },
    siteIds.length > 0
      ? supabaseAdmin
          .from('rhizomes')
          .select('id, site_key, site_label, site_type, profile_picture')
          .in('id', siteIds)
          .eq('site_type', siteType)
      : { data: [], error: null },
  ]);

  if (boardsResult.error || sitesResult.error) throw new Error('글 정보를 불러오지 못했습니다.');

  const boards = boardsResult.data ?? [];
  const sites = sitesResult.data ?? [];
  const boardMap = new Map(boards.map((board) => [board.id, board]));
  const siteMap = new Map(sites.map((site) => [site.id, site]));
  const authorIds = Array.from(new Set(posts.map((post) => post.user_id).filter((id): id is string => Boolean(id))));
  const [stigmasResult, membersResult] = await Promise.all([
    authorIds.length > 0
      ? supabaseAdmin.from('stigmas').select('id, user_name, avatar').in('id', authorIds)
      : { data: [], error: null },
    authorIds.length > 0 && siteIds.length > 0
      ? supabaseAdmin
          .from('rhizome_stigmas')
          .select('user_id, site_id, nickname')
          .in('user_id', authorIds)
          .in('site_id', siteIds)
      : { data: [], error: null },
  ]);

  if (stigmasResult.error || membersResult.error) throw new Error('작성자 정보를 불러오지 못했습니다.');

  const stigmaMap = new Map((stigmasResult.data ?? []).map((stigma) => [stigma.id, stigma]));
  const nicknameMap = new Map(
    (membersResult.data ?? []).map((member) => [`${member.site_id}:${member.user_id}`, normalizeText(member.nickname)]),
  );

  const coAuthorNames = await getCoAuthorNamesByPostIds(posts.map((post) => post.id));

  posts.forEach((post) => {
    const board = boardMap.get(post.board_id);
    const site = siteMap.get(post.site_id);

    if (!board || !site || !['basic', 'blog', 'feed', 'gallery', 'youtube'].includes(board.board_type)) return;

    const stigma = post.user_id ? stigmaMap.get(post.user_id) : null;
    const nickname = post.user_id ? nicknameMap.get(`${post.site_id}:${post.user_id}`) : '';
    const boardType = board.board_type as BoardType;
    const firstImage = getFirstPostImage(post.images);

    result.set(post.id, {
      id: post.id,
      href: `/${site.site_key}/${board.board_key}/${post.slug}`,
      siteType,
      siteName: normalizeText(site.site_label) || site.site_key,
      siteImage: getPublicImageUrl('avatar', site.profile_picture),
      boardType,
      authorName: coAuthorNames.get(post.id) ?? (nickname || decryptValue(stigma?.user_name ?? null)),
      authorImage: getPublicImageUrl('avatar', stigma?.avatar ?? null),
      publishedAt: post.published_at,
      postCount: post.post_count,
      subject: normalizeText(post.subject),
      summary: post.summary,
      contentHtml: post.content_html,
      contentSimple: post.content_simple,
      ...getListThumbnail(post),
      image: firstImage.url,
      imageWidth: firstImage.width,
      imageHeight: firstImage.height,
      youtubeId: post.youtube_id || extractYoutubeId(post.youtube_url),
      isClosed: post.is_closed,
      isPublished: post.published_status === 'published',
    });
  });

  return result;
}
