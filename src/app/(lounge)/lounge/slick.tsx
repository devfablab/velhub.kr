'use client';

import Slider from 'react-slick';
import ArrowBackIosRoundedIcon from '@mui/icons-material/ArrowBackIosRounded';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { formatDate, formatTimeAgo } from '@/lib/utils';
import { SlickProps } from '../page';
import Anchor from '@/components/Anchor';
import styles from '@/app/page.module.sass';

type ArrowProps = {
  className?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

function NextArrow(props: ArrowProps) {
  const { onClick } = props;
  return (
    <div className={`${styles['slick-arrow']} ${styles['slick-next']}`}>
      <button type="button" onClick={onClick} aria-label="다음 슬라이드 보기">
        <ArrowForwardIosRoundedIcon />
      </button>
    </div>
  );
}

function PrevArrow(props: ArrowProps) {
  const { onClick } = props;
  return (
    <div className={`${styles['slick-arrow']} ${styles['slick-prev']}`}>
      <button type="button" onClick={onClick} aria-label="이전 슬라이드 보기">
        <ArrowBackIosRoundedIcon />
      </button>
    </div>
  );
}

export default function Slick({ sitesCreatedData, sitesHitsData, postsData, isHub }: SlickProps) {
  const settings = {
    className: styles.slider,
    dots: false,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    variableWidth: true,
    nextArrow: <NextArrow />,
    prevArrow: <PrevArrow />,
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
            <Anchor key={site.site_key} href={`/${site.site_key}`}>
              <em>{site.site_type === 'blog' ? '블로그' : '커뮤니티'}</em>
              <strong>{site.site_label}</strong>
              <p>{site.summary}</p>
              <time>{formatDate(site.created_at)} 개설</time>
            </Anchor>
          ))}
        </Slider>
      </div>
    );
  }

  if (sitesHitsData) {
    return (
      <div className={`${styles.slider} ${styles['slider-hits-sites']}`}>
        <Slider {...settings}>
          {sitesHitsData.sites.map((site) => (
            <div key={site.site_key}>
              <Anchor href={`/${site.site_key}`} style={{ background: 'url(/dummy.webp) no-repeat center / cover' }}>
                <strong>{site.site_label}</strong>
                <p>{site.summary}</p>
                {site.site_type === 'blog' ? (
                  site.post_count ? (
                    <span>{site.post_count.toLocaleString()}개 포스팅</span>
                  ) : null
                ) : site.member_count ? (
                  <span>{site.member_count.toLocaleString()}명 가입</span>
                ) : null}
              </Anchor>
            </div>
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
                {isHub ? null : <em>{post.site_type === 'blog' ? '블로그' : '커뮤니티'}</em>}
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
                  <span>{post.site_label}</span> <PersonRoundedIcon />
                  <em>{post.author_name}</em>{' '}
                  {isHub ? (
                    <>
                      <VisibilityOutlinedIcon />
                      <span>{post.post_count}</span>
                    </>
                  ) : (
                    <>
                      <ScheduleRoundedIcon />
                      <time>{formatTimeAgo(post.published_at)}</time>
                    </>
                  )}
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
