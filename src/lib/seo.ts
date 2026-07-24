import { Metadata } from 'next';

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

interface SeoProps {
  pageTitles?: string;
  pageTitle?: string;
  pageDescription?: string;
  pageImg: string;
  pageTwt?: string;
  pageImgWidth?: number;
  pageImgHeight?: number;
  pageOgType?: OgType;
  pagePath: string;
}

export const originTitle = '데브허브 [콘텐츠에 가치를 더하는 복합 허브 서비스]';
export const mainTitle = '콘텐츠에 가치를 더하는 복합 허브 서비스 - 데브허브';

export function Seo({
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
  const domain = 'https://velhub.xyz';
  const defaultTitle = `${originTitle}`;
  const defaultDescription =
    '누구나 블로그와 커뮤니티를 개설하고, 콘텐츠를 공유하며, 멤버십과 후원을 운영할 수 있는 허브 플랫폼입니다.';
  const title = pageTitles || pageTitle || defaultTitle;
  const description = pageDescription || defaultDescription;
  const ogTitle = pageTitle || title;
  const url = `${domain}${pagePath}`;
  const imgUrl = `${pageImg}`;
  const imgTwt = pageTwt || pageImg;
  const imgWidth = pageImgWidth || 1280;
  const imgHeight = pageImgHeight || 630;
  const ogType: OgType = pageOgType || 'website';

  return {
    title: title,
    description: description,

    alternates: {
      canonical: url,
      languages: {
        'ko-KR': url,
      },
    },

    openGraph: {
      title: ogTitle,
      description: description,
      url: url,
      siteName: defaultTitle,
      locale: 'ko_KR',
      type: ogType,
      images: [
        {
          url: imgUrl,
          width: imgWidth,
          height: imgHeight,
        },
      ],
    },

    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: description,
      site: defaultTitle,
      images: [imgTwt],
    },
  };
}
