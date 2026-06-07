'use client';

import Slider from 'react-slick';
import ArrowBackIosRoundedIcon from '@mui/icons-material/ArrowBackIosRounded';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import { formatDate, formatTimeAgo } from '@/lib/utils';
import { SlickProps } from '../page';
import Anchor from '@/components/Anchor';
import styles from '@/app/page.module.sass';

type ArrowProps = {
  className?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

function SampleNextArrow(props: ArrowProps) {
  const { onClick } = props;
  return (
    <div className={`${styles['slick-arrow']} ${styles['slick-next']}`}>
      <button type="button" onClick={onClick} aria-label="다음 슬라이드 보기">
        <ArrowForwardIosRoundedIcon />
      </button>
    </div>
  );
}

function SamplePrevArrow(props: ArrowProps) {
  const { onClick } = props;
  return (
    <div className={`${styles['slick-arrow']} ${styles['slick-prev']}`}>
      <button type="button" onClick={onClick} aria-label="이전 슬라이드 보기">
        <ArrowBackIosRoundedIcon />
      </button>
    </div>
  );
}

export default function Slick({ sitesCreatedData, postsData }: SlickProps) {
  const settings = {
    className: styles.slider,
    dots: false,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    variableWidth: true,
    nextArrow: <SampleNextArrow />,
    prevArrow: <SamplePrevArrow />,
  };

  const YOUTUBE_THUMBNAIL_QUALITIES = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault', 'default'];

  function getYoutubeThumbnailUrl(videoId: string, quality: string) {
    return `https://i.ytimg.com/vi_webp/${videoId}/${quality}.webp`;
  }

  function stripHtmlTags(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getDescriptionFromHTML(html: string): string {
    const text = stripHtmlTags(html);
    return text.slice(0, 160);
  }

  if (sitesCreatedData) {
    return (
      <div className={`${styles.slider} ${styles['slider-created-sites']}`}>
        <Slider {...settings}>
          {sitesCreatedData.sites.map((site) => (
            <Anchor key={site.site_key} href={site.site_key}>
              <strong>{site.site_label}</strong>
              <p>{site.summary}</p>
              <time>{formatDate(site.created_at)} 개설</time>
            </Anchor>
          ))}
        </Slider>
      </div>
    );
  }

  if (postsData) {
    return (
      <div className={`${styles.slider} ${styles['slider-thumbnail']} ${styles['slider-posts']}`}>
        <Slider {...settings}>
          {postsData.posts.map((post) => (
            <div key={`${post.site_key}-${post.board_key}-${post.slug}`}>
              <Anchor
                href={`/${post.site_key}/${post.board_key}/${post.slug}`}
                style={{
                  aspectRatio:
                    post.board_type === 'gallery' || post.board_type === 'feed'
                      ? '1200 / 630'
                      : post.board_type === 'youtube' && post.thumbnail_width && post.thumbnail_height
                        ? `${post.thumbnail_width} / ${post.thumbnail_height}`
                        : post.board_type === 'youtube'
                          ? `1920 / 1080`
                          : 'none',
                  height:
                    post.board_type === 'gallery' || post.board_type === 'feed' || post.board_type === 'youtube'
                      ? 'auto'
                      : '100%',
                  background:
                    post.board_type === 'gallery' || post.board_type === 'feed'
                      ? `url(${post.image}) no-repeat center / cover`
                      : post.board_type === 'youtube'
                        ? `url(${post.thumbnail_image ? post.thumbnail_image : getYoutubeThumbnailUrl(post.youtube_id, YOUTUBE_THUMBNAIL_QUALITIES[0])})  no-repeat center / cover`
                        : 'url(/dummy.webp) no-repeat center / cover',
                }}
              >
                {post.board_type === 'gallery' && (
                  <>
                    <strong>{post.subject}</strong>
                    <p>{getDescriptionFromHTML(post.content_html)}</p>
                  </>
                )}
                {post.board_type === 'youtube' && (
                  <>
                    <strong>{post.subject}</strong>
                    <p>{post.summary}</p>
                  </>
                )}
                {post.board_type === 'feed' && (
                  <>
                    <p>{post.content_simple}</p>
                  </>
                )}
                {(post.board_type === 'basic' || post.board_type === 'blog') && (
                  <>
                    <strong>{post.subject}</strong>
                    <p>{getDescriptionFromHTML(post.content_html)}</p>
                  </>
                )}
                <div className={styles.tail}>
                  <span>{post.site_label}</span> <em>{post.author_name}</em>{' '}
                  <time>{formatTimeAgo(post.published_at)}</time>
                </div>
              </Anchor>
            </div>
          ))}
        </Slider>
      </div>
    );
  }

  return null;
}
