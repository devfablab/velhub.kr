import type { Metadata } from 'next';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type OgType =
  | 'article'
  | 'website'
  | 'book'
  | 'profile'
  | 'music.song'
  | 'music.album'
  | 'music.playlist'
  | 'music.radio_station'
  | 'video.movie'
  | 'video.episode'
  | 'video.tv_show'
  | 'video.other';

type SeoProps = {
  siteName: string;
  siteLabel: string;
  siteDescription?: string | null;
  isMain?: boolean;
  pageTitles?: string;
  pageTitle?: string;
  pageDescription?: string | null;
  pageImg?: string | null;
  pageTwt?: string | null;
  pageImgWidth?: number;
  pageImgHeight?: number;
  pageOgType?: OgType;
  pagePath: string;
};

type SitePageMetadataParams = {
  siteName: string;
  pagePath: string;
  pageTitle?: string;
  isMain?: boolean;
};

type BoardPageMetadataParams = {
  siteName: string;
  boardName: string;
  pagePath: string;
};

type PostPageMetadataParams = {
  siteName: string;
  boardName: string;
  contentId: string;
  pagePath: string;
};

type CategoryPageMetadataParams = {
  siteName: string;
  categoryName: string;
  pagePath: string;
};

type SeriesPageMetadataParams = {
  siteName: string;
  seriesName: string;
  pagePath: string;
};

type SiteSeoInfo = {
  id: string;
  siteKey: string;
  siteLabel: string;
  description: string;
  imageUrl: string;
};

const DOMAIN = 'https://velhub.xyz';

function getDefaultImageUrl() {
  const timestamp = Date.now();

  return `${DOMAIN}/og-etc.webp?ts=${timestamp}`;
}

function getPublicImageUrl(bucket: string, path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return '';
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from(bucket).getPublicUrl(normalizedPath);

  return publicUrl.data.publicUrl ?? '';
}

function getPostImageUrl(path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return '';
  }

  return getPublicImageUrl(normalizedPath.includes('/') ? 'post' : 'og-image', normalizedPath);
}

function isNumericSlug(value: string) {
  return /^\d+$/.test(value);
}

async function getSiteSeoInfo(siteName: string): Promise<SiteSeoInfo | null> {
  const normalizedSiteName = normalizeText(siteName).toLowerCase();

  if (!normalizedSiteName) {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_label, summary, og_image')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (siteResult.error || !siteResult.data) {
    return null;
  }

  const siteLabel = normalizeText(siteResult.data.site_label) || normalizeText(siteResult.data.site_key);
  const description = normalizeText(siteResult.data.summary) || siteLabel;

  return {
    id: siteResult.data.id,
    siteKey: normalizeText(siteResult.data.site_key),
    siteLabel,
    description,
    imageUrl: getPublicImageUrl('site-og', siteResult.data.og_image),
  };
}

function getFallbackMetadata(siteName: string, pagePath: string): Metadata {
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const fallbackLabel = normalizedSiteName || '사이트';

  return Seo({
    siteName: normalizedSiteName,
    siteLabel: fallbackLabel,
    siteDescription: fallbackLabel,
    pageImg: getDefaultImageUrl(),
    pagePath,
  });
}

export function Seo({
  siteName,
  siteLabel,
  siteDescription,
  isMain = false,
  pageTitles,
  pageTitle,
  pageDescription,
  pageImg,
  pageImgWidth,
  pageImgHeight,
  pageOgType,
  pageTwt,
  pagePath,
}: SeoProps): Metadata {
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const normalizedSiteLabel = normalizeText(siteLabel);
  const description = normalizeText(pageDescription) || normalizeText(siteDescription) || normalizedSiteLabel;
  const originTitle = `${normalizedSiteLabel} [${normalizeText(siteDescription) || normalizedSiteLabel}]`;
  const mainTitle = `${normalizeText(siteDescription) || normalizedSiteLabel} - ${normalizedSiteLabel}`;
  const title = pageTitles || (isMain ? mainTitle : pageTitle ? `${pageTitle} - ${originTitle}` : originTitle);
  const ogTitle = pageTitle || title;
  const baseUrl = `${DOMAIN}/${normalizedSiteName}`;
  const normalizedPagePath = pagePath === '/' ? '' : pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
  const url = `${baseUrl}${normalizedPagePath}`;
  const imageUrl = normalizeText(pageImg) || getDefaultImageUrl();
  const twitterImageUrl = normalizeText(pageTwt) || imageUrl;
  const imageWidth = pageImgWidth || 1280;
  const imageHeight = pageImgHeight || 630;
  const ogType: OgType = pageOgType || 'website';

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        'ko-KR': url,
      },
    },
    openGraph: {
      title: ogTitle,
      description,
      url,
      siteName: originTitle,
      locale: 'ko_KR',
      type: ogType,
      images: [
        {
          url: imageUrl,
          width: imageWidth,
          height: imageHeight,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
      site: originTitle,
      images: [twitterImageUrl],
    },
  };
}

export async function getSitePageMetadata({
  siteName,
  pagePath,
  pageTitle,
  isMain = false,
}: SitePageMetadataParams): Promise<Metadata> {
  const site = await getSiteSeoInfo(siteName);

  if (!site) {
    return getFallbackMetadata(siteName, pagePath);
  }

  return Seo({
    siteName: site.siteKey,
    siteLabel: site.siteLabel,
    siteDescription: site.description,
    isMain,
    pageTitle,
    pageDescription: site.description,
    pageImg: site.imageUrl || getDefaultImageUrl(),
    pagePath,
  });
}

export async function getBoardPageMetadata({
  siteName,
  boardName,
  pagePath,
}: BoardPageMetadataParams): Promise<Metadata> {
  const site = await getSiteSeoInfo(siteName);

  if (!site) {
    return getFallbackMetadata(siteName, pagePath);
  }

  const normalizedBoardName = normalizeText(boardName).toLowerCase();
  const supabaseAdmin = getSupabaseAdmin();
  const boardResult = await supabaseAdmin
    .from('boards')
    .select('board_label')
    .eq('site_id', site.id)
    .eq('board_key', normalizedBoardName)
    .maybeSingle();
  const boardLabel = normalizeText(boardResult.data?.board_label) || normalizedBoardName;

  return Seo({
    siteName: site.siteKey,
    siteLabel: site.siteLabel,
    siteDescription: site.description,
    pageTitle: boardLabel,
    pageDescription: site.description,
    pageImg: site.imageUrl || getDefaultImageUrl(),
    pagePath,
  });
}

export async function getPostPageMetadata({
  siteName,
  boardName,
  contentId,
  pagePath,
}: PostPageMetadataParams): Promise<Metadata> {
  const site = await getSiteSeoInfo(siteName);

  if (!site) {
    return getFallbackMetadata(siteName, pagePath);
  }

  const normalizedBoardName = normalizeText(boardName).toLowerCase();
  const normalizedContentId = normalizeText(contentId);
  const supabaseAdmin = getSupabaseAdmin();
  const boardResult = await supabaseAdmin
    .from('boards')
    .select('id')
    .eq('site_id', site.id)
    .eq('board_key', normalizedBoardName)
    .maybeSingle();

  if (boardResult.error || !boardResult.data || !normalizedContentId) {
    return getSitePageMetadata({
      siteName: site.siteKey,
      pagePath,
    });
  }

  let postQuery = supabaseAdmin
    .from('posts')
    .select('subject, summary, thumbnail_image')
    .eq('site_id', site.id)
    .eq('board_id', boardResult.data.id);

  if (isNumericSlug(normalizedContentId)) {
    postQuery = postQuery.eq('slug', Number(normalizedContentId));
  } else {
    postQuery = postQuery.eq('id', normalizedContentId);
  }

  const postResult = await postQuery.maybeSingle();

  if (postResult.error || !postResult.data) {
    return getSitePageMetadata({
      siteName: site.siteKey,
      pagePath,
    });
  }

  const subject = normalizeText(postResult.data.subject);
  const description = normalizeText(postResult.data.summary) || subject;
  const postImageUrl = getPostImageUrl(postResult.data.thumbnail_image);

  return Seo({
    siteName: site.siteKey,
    siteLabel: site.siteLabel,
    siteDescription: site.description,
    pageTitle: subject,
    pageDescription: description,
    pageImg: postImageUrl || site.imageUrl || getDefaultImageUrl(),
    pageOgType: 'article',
    pagePath,
  });
}

export async function getCategoryPageMetadata({
  siteName,
  categoryName,
  pagePath,
}: CategoryPageMetadataParams): Promise<Metadata> {
  const site = await getSiteSeoInfo(siteName);

  if (!site) {
    return getFallbackMetadata(siteName, pagePath);
  }

  const normalizedCategoryName = normalizeText(categoryName).toLowerCase();
  const supabaseAdmin = getSupabaseAdmin();
  const categoryResult = await supabaseAdmin
    .from('board_categories')
    .select('category_label, summary, thumbnail_image')
    .eq('site_id', site.id)
    .eq('category_key', normalizedCategoryName)
    .maybeSingle();

  if (categoryResult.error || !categoryResult.data) {
    return getSitePageMetadata({
      siteName: site.siteKey,
      pagePath,
      pageTitle: normalizedCategoryName,
    });
  }

  const categoryLabel = normalizeText(categoryResult.data.category_label);
  const description = normalizeText(categoryResult.data.summary) || categoryLabel;
  const categoryImageUrl = getPublicImageUrl('category', categoryResult.data.thumbnail_image);

  return Seo({
    siteName: site.siteKey,
    siteLabel: site.siteLabel,
    siteDescription: site.description,
    pageTitle: categoryLabel,
    pageDescription: description,
    pageImg: categoryImageUrl || site.imageUrl || getDefaultImageUrl(),
    pagePath,
  });
}

export async function getSeriesPageMetadata({
  siteName,
  seriesName,
  pagePath,
}: SeriesPageMetadataParams): Promise<Metadata> {
  const site = await getSiteSeoInfo(siteName);

  if (!site) {
    return getFallbackMetadata(siteName, pagePath);
  }

  const normalizedSeriesName = normalizeText(seriesName).toLowerCase();
  const supabaseAdmin = getSupabaseAdmin();
  const seriesResult = await supabaseAdmin
    .from('board_series')
    .select('series_label, summary, thumbnail_image')
    .eq('site_id', site.id)
    .eq('series_key', normalizedSeriesName)
    .maybeSingle();

  if (seriesResult.error || !seriesResult.data) {
    return getSitePageMetadata({
      siteName: site.siteKey,
      pagePath,
      pageTitle: normalizedSeriesName,
    });
  }

  const seriesLabel = normalizeText(seriesResult.data.series_label);
  const description = normalizeText(seriesResult.data.summary) || seriesLabel;
  const seriesImageUrl = getPublicImageUrl('series', seriesResult.data.thumbnail_image);

  return Seo({
    siteName: site.siteKey,
    siteLabel: site.siteLabel,
    siteDescription: site.description,
    pageTitle: seriesLabel,
    pageDescription: description,
    pageImg: seriesImageUrl || site.imageUrl || getDefaultImageUrl(),
    pagePath,
  });
}
