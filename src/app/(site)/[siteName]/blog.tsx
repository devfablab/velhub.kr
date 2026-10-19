'use client';

import { type CSSProperties, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import ArrowBackIosRoundedIcon from '@mui/icons-material/ArrowBackIosRounded';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import { Avatar, Typography, useMediaQuery, useTheme } from '@mui/material';
import Slider from 'react-slick';
import type { PostListItem } from '@/lib/board/getPostList';
import { formatTimeAgo } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import BlogAdReportButton from '@/components/service/blog/BlogAdReportButton';
import SiteProfile from '@/components/service/blog/SiteProfile';
import ReportButton from '@/components/service/common/ReportButton';
import ScreenState from '@/components/service/ScreenState';
import Container from './menu';
import styles from '@/app/board.module.sass';

type RowValue = string | number | boolean | null;

type SitesInfo = {
  sites: {
    updated_at: RowValue;
    updated_by: RowValue;
  };
};

type BlogInfo = {
  created_at: RowValue;
  comment_provider: RowValue;
};

type BoardType = 'basic' | 'gallery' | 'youtube' | 'feed' | 'page';

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: BoardType;
  markdown_status: string | null;
  post_type: 'none' | 'prefix' | 'series' | null;
  is_active: boolean;
  sort_order: number | null;
};

export type BlogHomePost = {
  id: string;
  slug: string;
  subject: string;
  summary: string | null;
  contentHtml: string | null;
  thumbnailImageUrl: string | null;
  thumbnailWidth: number | null;
  thumbnailHeight: number | null;
  publishedAt: string | null;
  postCount: number;
  likeCount: number;
  authorName: string;
  authorAvatarUrl: string | null;
};

export type BlogHomeCommunityPost = {
  id: string;
  slug: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
  images: string[];
  commentCount: number;
};

export type BlogHomeData = {
  recommendedPosts: BlogHomePost[];
  popularPosts: BlogHomePost[];
  communityPosts: BlogHomeCommunityPost[];
};

export type BlogHomeCategory = {
  id: string;
  key: string;
  label: string;
  summary: string | null;
  imageUrl: string | null;
};

export type BlogHomeSeries = {
  id: string;
  key: string;
  label: string;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  isCompleted: boolean;
};

export type BlogHomeAd = {
  id: string;
  productName: string;
  shopName: string;
  thumbnailUrl: string;
  linkUrl: string;
  domain: string;
};

type Props = {
  siteName: string;
  board?: BoardRow | null;
  sitesInfo: SitesInfo;
  blogInfo: BlogInfo;
  hasPublishedPosts?: boolean;
  homeData?: BlogHomeData | null;
  categories?: BlogHomeCategory[];
  series?: BlogHomeSeries[];
  ads?: BlogHomeAd[];
  communityTitle?: string;
  communityAvatarUrl?: string | null;
};

type SliderArrowProps = {
  className?: string;
  onClick?: () => void;
  direction: 'next' | 'previous';
};

function SliderArrow({ direction, onClick }: Pick<SliderArrowProps, 'direction' | 'onClick'>) {
  const isNext = direction === 'next';

  return (
    <div className={`${styles['slick-arrow']} ${isNext ? styles['slick-next'] : styles['slick-prev']}`}>
      <button type="button" onClick={onClick} aria-label={isNext ? '다음 게시물 보기' : '이전 게시물 보기'}>
        {isNext ? <ArrowForwardIosRoundedIcon /> : <ArrowBackIosRoundedIcon />}
      </button>
    </div>
  );
}

function BlogPostNextArrow({ onClick }: Pick<SliderArrowProps, 'onClick'>) {
  return (
    <div className={`${styles['slick-arrow']} ${styles['slick-next']}`}>
      <button type="button" onClick={onClick} aria-label="다음 슬라이드 보기">
        <ArrowForwardIosRoundedIcon />
      </button>
    </div>
  );
}

function BlogPostPrevArrow({ onClick }: Pick<SliderArrowProps, 'onClick'>) {
  return (
    <div className={`${styles['slick-arrow']} ${styles['slick-prev']}`}>
      <button type="button" onClick={onClick} aria-label="이전 슬라이드 보기">
        <ArrowBackIosRoundedIcon />
      </button>
    </div>
  );
}

function getContentDescription(contentHtml: string | null) {
  const plainText = (contentHtml ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

  return Array.from(plainText).slice(0, 327).join('');
}

function BlogPostCarousel({ posts, siteName }: { posts: BlogHomePost[]; siteName: string }) {
  const settings = {
    className: styles.slider,
    dots: false,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    variableWidth: true,
    nextArrow: <BlogPostNextArrow />,
    prevArrow: <BlogPostPrevArrow />,
  };

  return (
    <div className={`${styles.slider} ${styles['slider-thumbnail']}`}>
      <Slider {...settings}>
        {posts.map((post) => (
          <div key={post.id}>
            <Anchor
              href={`/${siteName}/b/${post.slug}`}
              style={{
                background: `url(${post.thumbnailImageUrl ?? '/dummy.webp'}) no-repeat center / cover`,
              }}
            >
              <strong>{post.subject}</strong>
              <p>{getContentDescription(post.contentHtml)}</p>
              <div className={styles.tail}>
                <span>{post.authorName}</span>
                {post.publishedAt ? (
                  <>
                    <ScheduleRoundedIcon />
                    <time dateTime={post.publishedAt}>{formatTimeAgo(post.publishedAt)}</time>
                  </>
                ) : null}
              </div>
            </Anchor>
          </div>
        ))}
      </Slider>
    </div>
  );
}

function BlogCommunityCarousel({
  posts,
  siteName,
  communityTitle,
  communityAvatarUrl,
}: {
  posts: BlogHomeCommunityPost[];
  siteName: string;
  communityTitle: string;
  communityAvatarUrl: string | null;
}) {
  const containerReference = useRef<HTMLDivElement | null>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [truncatedPostIds, setTruncatedPostIds] = useState<string[]>([]);
  const theme = useTheme();
  const isSmallUp = useMediaQuery(theme.breakpoints.up('sm'));
  const hasImages = posts.some((post) => post.images.length > 0);

  useEffect(() => {
    function updateContentHeight() {
      const container = containerReference.current;

      if (!container) {
        return;
      }

      container.style.removeProperty('--blog-community-card-height');

      if (!hasImages) {
        const cards = container.querySelectorAll<HTMLElement>('[data-blog-home-community-card]');
        const nextHeight = Math.max(...Array.from(cards, (card) => card.scrollHeight), 0);
        if (nextHeight) {
          container.style.setProperty('--blog-community-card-height', `${nextHeight}px`);
        }
        setContentHeight(nextHeight || null);
      } else {
        setContentHeight(null);
      }

      const nextTruncatedPostIds = Array.from(container.querySelectorAll<HTMLElement>('[data-blog-community-content]'))
        .filter((content) => content.scrollHeight > content.clientHeight)
        .map((content) => content.dataset.blogCommunityContent ?? '')
        .filter(Boolean);

      setTruncatedPostIds((previousPostIds) =>
        previousPostIds.length === nextTruncatedPostIds.length &&
        previousPostIds.every((postId, index) => postId === nextTruncatedPostIds[index])
          ? previousPostIds
          : nextTruncatedPostIds,
      );
    }

    const frame = window.requestAnimationFrame(updateContentHeight);
    window.addEventListener('resize', updateContentHeight);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateContentHeight);
    };
  }, [hasImages, posts, truncatedPostIds]);

  const settings = {
    className: styles.slider,
    dots: false,
    infinite: false,
    speed: 350,
    slidesToShow: isSmallUp ? 2.14 : 1.07,
    slidesToScroll: 1,
    nextArrow: <SliderArrow direction="next" />,
    prevArrow: <SliderArrow direction="previous" />,
  };

  return (
    <div
      ref={containerReference}
      className={`${styles['blog-community-slider']} ${hasImages ? styles['blog-community-slider-image'] : ''}`}
      style={contentHeight ? ({ '--blog-community-card-height': `${contentHeight}px` } as CSSProperties) : undefined}
    >
      <Slider {...settings}>
        {posts.map((post) => (
          <div key={post.id} className={styles['blog-home-community-slide']}>
            <Anchor
              href={`/${siteName}/community-on-blog/${post.slug}`}
              className={styles['blog-home-community-card']}
              data-blog-home-community-card
            >
              <div className={styles['blog-home-community-meta']}>
                <Avatar src={communityAvatarUrl ?? undefined} alt="" />
                <span>
                  <strong>{post.authorName}</strong>
                  <small>
                    <time dateTime={post.createdAt}>{formatTimeAgo(post.createdAt)}</time>
                  </small>
                </span>
              </div>
              <div className={styles['blog-home-community-body']}>
                <p data-blog-community-content={post.id}>{post.content}</p>
                <span
                  className={`${styles['blog-home-community-more']} ${truncatedPostIds.includes(post.id) ? '' : styles.hidden}`}
                >
                  자세히 알아보기
                </span>
                {post.images.length ? (
                  <div className={`${styles['content-images']} ${styles['blog-home-community-images']}`}>
                    {post.images.map((image) => (
                      <div key={image} className={styles['content-thumbnail-image']}>
                        <img src={image} alt="" />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className={styles['blog-home-community-actions']}>
                <span>
                  <ChatBubbleOutlineRoundedIcon />
                  {post.commentCount}
                </span>
              </div>
            </Anchor>
            <div className={styles['blog-home-community-report']}>
              <ReportButton targetType="blog_community_post" siteName={siteName} contentId={post.slug} />
            </div>
          </div>
        ))}
      </Slider>
    </div>
  );
}

type BlogRecentPostsResponse = {
  contents?: PostListItem[];
};

function BlogRecentPosts({ boardName, siteName }: { boardName: string; siteName: string }) {
  const [posts, setPosts] = useState<PostListItem[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRecentPosts() {
      try {
        const response = await fetch(
          `/api/boards/${encodeURIComponent(boardName)}?${new URLSearchParams({
            siteName,
            page: '1',
            size: '12',
            includePin: 'false',
          }).toString()}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as BlogRecentPostsResponse;
        setPosts(Array.isArray(data.contents) ? data.contents : []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setPosts([]);
        }
      }
    }

    void loadRecentPosts();

    return () => controller.abort();
  }, [boardName, siteName]);

  return (
    <section className={styles['blog-home-list-section']}>
      <h2>최근 글</h2>
      <div className={styles['see-more']}>
        <Anchor href={`/${siteName}/${boardName}`}>
          <span>더보기</span>
          <ArrowForwardRoundedIcon />
        </Anchor>
      </div>
      <div className={`paper ${styles['blog-home-recent']}`} aria-busy={posts === null}>
        {posts === null ? (
          <div className={styles['blog-home-recent-loading']}>
            <LoadingIndicator size={26} />
          </div>
        ) : (
          <div className={styles['blog-items']}>
            {posts.map((post) => (
              <Anchor href={`/${siteName}/${boardName}/${post.slug}`} key={post.id}>
                <div className={styles.thumbnail}>
                  <span>{post.published_status === 'draft' ? <em>(임시글)</em> : null}</span>
                  {post.thumbnail_image_url ? (
                    <Image
                      src={post.thumbnail_image_url}
                      alt=""
                      width={post.thumbnail_width ?? 1200}
                      height={post.thumbnail_height ?? 630}
                    />
                  ) : (
                    <div className={styles.dummy}>
                      <MenuBookRoundedIcon />
                    </div>
                  )}
                </div>
                <div className={styles.info}>
                  <div className={styles.subject}>
                    <strong>{post.series_label ? `[${post.series_label}] ${post.subject}` : post.subject}</strong>
                    <span>{post.summary}</span>
                  </div>
                  <div className={styles.author}>{post.author_name}</div>
                  <div className={styles.tail}>
                    <time>{formatTimeAgo(post.published_at ?? post.created_at)}</time>
                    {post.comment_count > 0 ? <span>댓글 {post.comment_count}</span> : null}
                    <span>조회 {post.post_count}</span>
                  </div>
                </div>
              </Anchor>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function Blog(props: Props) {
  if (props.board === null || props.board === undefined || props.hasPublishedPosts === false) {
    return (
      <Container>
        <div className="container">
          <div className={`content ${styles.content} ${styles['blog-content']} `}>
            <SiteProfile />
            <ScreenState>출간된 글이 없습니다. 😭</ScreenState>
          </div>
        </div>
      </Container>
    );
  }
  return (
    <Container>
      <div className="container">
        <div className={`content ${styles.content} ${styles['blog-content']} `}>
          <SiteProfile />
          {props.homeData?.recommendedPosts.length ? (
            <section className={styles['blog-home-slider-section']}>
              <h2>추천 게시물</h2>
              <BlogPostCarousel posts={props.homeData.recommendedPosts} siteName={props.siteName} />
            </section>
          ) : null}

          {props.homeData?.popularPosts.length ? (
            <section className={styles['blog-home-slider-section']}>
              <h2>인기 게시물</h2>
              <BlogPostCarousel posts={props.homeData.popularPosts} siteName={props.siteName} />
            </section>
          ) : null}

          {props.homeData?.communityPosts.length ? (
            <section className={styles['blog-home-slider-section']}>
              <h2>블로그 커뮤니티</h2>
              <BlogCommunityCarousel
                posts={props.homeData.communityPosts}
                siteName={props.siteName}
                communityTitle={props.communityTitle ?? ''}
                communityAvatarUrl={props.communityAvatarUrl ?? null}
              />
            </section>
          ) : null}

          {props.ads?.length ? (
            <div className={`paper ${styles['blog-ads']}`}>
              {props.ads[0]?.shopName ? (
                <Typography variant="subtitle2">{props.ads[0].shopName} 제공</Typography>
              ) : null}
              <div className={styles['blog-ad-items']}>
                {props.ads.map((ad) => (
                  <div key={ad.id} className={`paper ${styles['blog-ad-item']}`}>
                    <Anchor href={ad.linkUrl}>
                      <img src={ad.thumbnailUrl} alt="" />
                      <span>
                        <strong>{ad.productName}</strong>
                        <em>{ad.domain}</em>
                      </span>
                    </Anchor>
                    <BlogAdReportButton siteName={props.siteName} adId={ad.id} targetType="ad" />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {props.categories?.length ? (
            <section className={styles['blog-home-list-section']}>
              <h2>카테고리</h2>
              <div className="paper">
                <div className={`${styles['category-items']} ${styles['blog-items']}`}>
                  {props.categories.map((category) => (
                    <Anchor href={`/${props.siteName}/c/${category.key}`} key={category.id}>
                      <div className={styles.thumbnail}>
                        {category.imageUrl ? (
                          <img src={category.imageUrl} alt="" />
                        ) : (
                          <div className={styles.dummy}>
                            <MenuBookRoundedIcon />
                          </div>
                        )}
                      </div>
                      <div className={styles.info}>
                        <strong>{category.label}</strong>
                        {category.summary ? <p>{category.summary}</p> : null}
                      </div>
                    </Anchor>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {props.series?.length ? (
            <section className={styles['blog-home-list-section']}>
              <h2>연재</h2>
              <div className="paper">
                <div className={`${styles['series-items']} ${styles['blog-items']}`}>
                  {props.series.map((series) => (
                    <Anchor href={`/${props.siteName}/s/${series.key}`} key={series.id}>
                      <div className={styles.thumbnail}>
                        {series.imageUrl ? (
                          <img src={series.imageUrl} alt="" />
                        ) : (
                          <div className={styles.dummy}>
                            <MenuBookRoundedIcon />
                          </div>
                        )}
                      </div>
                      <div className={styles.info}>
                        <strong>{series.label}</strong>
                        {series.isCompleted ? <em>완결</em> : null}
                        {series.summary ? <p>{series.summary}</p> : null}
                        {series.publishedAt ? <time>{formatTimeAgo(series.publishedAt)}</time> : null}
                      </div>
                    </Anchor>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <BlogRecentPosts boardName={props.board.board_key} siteName={props.siteName} />
        </div>
      </div>
    </Container>
  );
}
