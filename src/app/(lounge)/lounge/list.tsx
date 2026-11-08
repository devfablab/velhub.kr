/* eslint-disable react-hooks/purity */
'use client';

import { useEffect, useState } from 'react';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { Avatar, Box, Chip, Skeleton, useMediaQuery, useTheme } from '@mui/material';
import { formatTimeAgo } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import AppIconAvatar from '@/components/customUI/AppIconAvatar';
import OptimizedImage from '@/components/OptimizedImage';
import type { ListProps, PostsResponse } from '../page';
import styles from '@/app/page.module.sass';

function LoadingNewestCards({ isMobile }: { isMobile: boolean }) {
  return (
    <div className={`${styles.list} ${styles['list-newest']}`}>
      <div className={`paper ${styles.item}`}>
        <div className={styles.skeleton}>
          {isMobile ? (
            <div className={`${styles['description-item']} ${styles['description-item-mini']}`}>
              <div className={styles.description}>
                <Box sx={{ mb: 1 }}>
                  <Chip label="..." size="small" className="chip success" />
                </Box>
                <div className={styles.info}>
                  <Skeleton variant="rounded" height={24} />
                  <Skeleton variant="rounded" height={63} />
                </div>
                <div className={styles.tail}>
                  <div className={styles['tail-author']}>
                    <Skeleton variant="circular" width={24} height={24} component="div" />
                    <Skeleton variant="rounded" width={32} height={24} component="strong" />
                    <ScheduleRoundedIcon />
                    <Skeleton variant="rounded" width={32} height={24} component="time" />
                  </div>
                  <div className={styles['tail-site']}>
                    <AppIconAvatar site="community" src={null} alt="" size={24} />
                    <Skeleton variant="rounded" width={32} height={24} component="strong" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className={styles['description-item']}>
                <div className={styles.description}>
                  <Box sx={{ mb: 1 }}>
                    <Chip label="..." size="small" className="chip success" />
                  </Box>
                  <div className={styles.info}>
                    <Skeleton variant="rounded" height={24} />
                    <Skeleton variant="rounded" height={63} />
                  </div>
                </div>
              </div>
              <div className={styles.tail}>
                <div className={styles['tail-container']}>
                  <Skeleton variant="circular" width={24} height={24} component="div" />
                  <Skeleton variant="rounded" width={32} height={24} component="strong" />
                  <ScheduleRoundedIcon />
                  <Skeleton variant="rounded" width={32} height={24} component="time" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <div className={`paper ${styles.item}`}>
        <div className={styles.skeleton}>
          {isMobile ? (
            <div className={`${styles['description-item']} ${styles['description-item-mini']}`}>
              <div className={styles.description}>
                <Box sx={{ mb: 1 }}>
                  <Chip label="..." size="small" className="chip success" />
                </Box>
                <div className={styles.info}>
                  <Skeleton variant="rounded" height={24} />
                  <Skeleton variant="rounded" height={63} />
                </div>
                <div className={styles.tail}>
                  <div className={styles['tail-author']}>
                    <Skeleton variant="circular" width={24} height={24} component="div" />
                    <Skeleton variant="rounded" width={32} height={24} component="strong" />
                    <ScheduleRoundedIcon />
                    <Skeleton variant="rounded" width={32} height={24} component="time" />
                  </div>
                  <div className={styles['tail-site']}>
                    <AppIconAvatar site="community" src={null} alt="" size={24} />
                    <Skeleton variant="rounded" width={32} height={24} component="strong" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className={styles['description-item']}>
                <div className={styles.description}>
                  <Box sx={{ mb: 1 }}>
                    <Chip label="..." size="small" className="chip success" />
                  </Box>
                  <div className={styles.info}>
                    <Skeleton variant="rounded" height={24} />
                    <Skeleton variant="rounded" height={63} />
                  </div>
                </div>
              </div>
              <div className={styles.tail}>
                <div className={styles['tail-container']}>
                  <Skeleton variant="circular" width={24} height={24} component="div" />
                  <Skeleton variant="rounded" width={32} height={24} component="strong" />
                  <ScheduleRoundedIcon />
                  <Skeleton variant="rounded" width={32} height={24} component="time" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingHitsCards() {
  return (
    <div className={`${styles.list} ${styles['list-hits']}`}>
      <div className={`paper paper-p0 ${styles.item}`}>
        <div className={styles.skeleton}>
          <div className={styles.thumbnail}>
            <Skeleton variant="rounded" height={24} component="div" className="dummy" />
          </div>
          <div className={styles['description-item']}>
            <div className={styles.description}>
              <div className={styles.info}>
                <Skeleton variant="rounded" height={24} />
                <Skeleton variant="rounded" height={63} />
              </div>
            </div>
            <div className={styles.tail}>
              <div className={styles['tail-site']}>
                <AppIconAvatar site="community" src={null} alt="" size={24} />
                <Skeleton variant="rounded" width={32} height={24} component="strong" />
              </div>
              <div className={styles['tail-author']}>
                <Skeleton variant="circular" width={24} height={24} component="div" />
                <Skeleton variant="rounded" width={32} height={24} component="strong" />
              </div>
              <div className={styles['tail-date']}>
                <ScheduleRoundedIcon />
                <Skeleton variant="rounded" width={32} height={24} component="time" />
                <VisibilityOutlinedIcon />
                <Skeleton variant="rounded" width={32} height={24} component="time" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={`paper paper-p0 ${styles.item}`}>
        <div className={styles.skeleton}>
          <div className={styles.thumbnail}>
            <Skeleton variant="rounded" height={24} component="div" className="dummy" />
          </div>
          <div className={styles['description-item']}>
            <div className={styles.description}>
              <div className={styles.info}>
                <Skeleton variant="rounded" height={24} />
                <Skeleton variant="rounded" height={63} />
              </div>
            </div>
            <div className={styles.tail}>
              <div className={styles['tail-site']}>
                <AppIconAvatar site="community" src={null} alt="" size={24} />
                <Skeleton variant="rounded" width={32} height={24} component="strong" />
              </div>
              <div className={styles['tail-author']}>
                <Skeleton variant="circular" width={24} height={24} component="div" />
                <Skeleton variant="rounded" width={32} height={24} component="strong" />
              </div>
              <div className={styles['tail-date']}>
                <ScheduleRoundedIcon />
                <Skeleton variant="rounded" width={32} height={24} component="time" />
                <VisibilityOutlinedIcon />
                <Skeleton variant="rounded" width={32} height={24} component="time" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={`paper paper-p0 ${styles.item}`}>
        <div className={styles.skeleton}>
          <div className={styles.thumbnail}>
            <Skeleton variant="rounded" height={24} component="div" className="dummy" />
          </div>
          <div className={styles['description-item']}>
            <div className={styles.description}>
              <div className={styles.info}>
                <Skeleton variant="rounded" height={24} />
                <Skeleton variant="rounded" height={63} />
              </div>
            </div>
            <div className={styles.tail}>
              <div className={styles['tail-site']}>
                <AppIconAvatar site="community" src={null} alt="" size={24} />
                <Skeleton variant="rounded" width={32} height={24} component="strong" />
              </div>
              <div className={styles['tail-author']}>
                <Skeleton variant="circular" width={24} height={24} component="div" />
                <Skeleton variant="rounded" width={32} height={24} component="strong" />
              </div>
              <div className={styles['tail-date']}>
                <ScheduleRoundedIcon />
                <Skeleton variant="rounded" width={32} height={24} component="time" />
                <VisibilityOutlinedIcon />
                <Skeleton variant="rounded" width={32} height={24} component="time" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function List({ orderType, postsApiPath, initialData, onPostsLoaded }: ListProps) {
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;
  const [loadedPostsData, setLoadedPostsData] = useState<PostsResponse | null>(initialData ?? null);
  const listPostsApiPath = postsApiPath ?? '/api/home/posts?limit=20';

  useEffect(() => {
    let isMounted = true;

    if (initialData) {
      onPostsLoaded?.(initialData.posts.length);
      return () => {
        isMounted = false;
      };
    }

    async function loadPosts() {
      try {
        const response = await fetch(listPostsApiPath);
        const result = (await response.json()) as PostsResponse;

        if (isMounted && response.ok && Array.isArray(result.posts)) {
          setLoadedPostsData(result);
          onPostsLoaded?.(result.posts.length);
        }
      } catch {
        // 조회에 실패해도 초기 로딩 카드의 구조는 유지한다.
      }
    }

    void loadPosts();

    return () => {
      isMounted = false;
    };
  }, [initialData, listPostsApiPath, onPostsLoaded]);

  const resolvedPostsData = initialData ?? loadedPostsData;

  function getYoutubeThumbnailUrl(videoId: string) {
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }

  function stripHtmlTags(html: string | null | undefined): string {
    return (html ?? '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getDescriptionFromHTML(html: string | null | undefined): string {
    const text = stripHtmlTags(html);
    return text.slice(0, 160);
  }

  if (!resolvedPostsData && orderType === 'newest') {
    return <LoadingNewestCards isMobile={isMobile} />;
  }

  if (!resolvedPostsData && orderType === 'hits') {
    return <LoadingHitsCards />;
  }

  if (resolvedPostsData && orderType === 'newest') {
    return (
      <div className={`${styles.list} ${styles['list-newest']}`}>
        {resolvedPostsData.posts.map((post) => (
          <div
            key={`${post.site_key}-${post.board_key}-${post.slug || Math.random()}`}
            className={`paper ${styles.item}`}
          >
            <Anchor href={`${post.site_url}/${post.board_key}/${post.slug}`}>
              {isMobile ? (
                <div className={`${styles['description-item']} ${styles['description-item-mini']}`}>
                  <div className={styles.description}>
                    <Box sx={{ mb: 1 }}>
                      <Chip
                        label={post.site_type === 'blog' ? '블로그' : '커뮤니티'}
                        size="small"
                        className="chip success"
                      />
                    </Box>
                    {post.board_type === 'gallery' && (
                      <div className={styles.info}>
                        <strong>{post.subject}</strong>
                        <p>{getDescriptionFromHTML(post.content_html)}</p>
                      </div>
                    )}
                    {post.board_type === 'youtube' && (
                      <div className={styles.info}>
                        <strong>{post.subject}</strong>
                        <p>{post.summary}</p>
                      </div>
                    )}
                    {post.board_type === 'feed' && (
                      <div className={styles.info}>
                        <p>{post.content_simple}</p>
                      </div>
                    )}
                    {(post.board_type === 'basic' || post.board_type === 'blog') && (
                      <div className={styles.info}>
                        <strong>{post.subject}</strong>
                        <p>{getDescriptionFromHTML(post.content_html)}</p>
                      </div>
                    )}
                    <div className={styles.tail}>
                      <div className={styles['tail-author']}>
                        <Avatar
                          src={post.author_name ? post.author_avatar || '/broken-image.jpg' : undefined}
                          alt={post.author_name}
                          sx={{ width: 24, height: 24 }}
                        />
                        <strong>{post.author_name}</strong>
                        <ScheduleRoundedIcon />
                        <time>{formatTimeAgo(post.published_at)}</time>
                      </div>
                      <div className={styles['tail-site']}>
                        <AppIconAvatar site={post.site_type} src={post.profile_picture || null} alt="" size={24} />
                        <strong>{post.site_label}</strong>
                      </div>
                    </div>
                  </div>
                  {post.board_type === 'gallery' && (
                    <div className={styles.thumbnail}>
                      <OptimizedImage
                        src={post.image}
                        width={post.image_width}
                        height={post.image_height}
                        sizes="172px"
                      />
                    </div>
                  )}
                  {post.board_type === 'youtube' && (
                    <div className={styles.thumbnail}>
                      {post.thumbnail_image ? (
                        <OptimizedImage
                          src={post.thumbnail_image}
                          width={post.thumbnail_width}
                          height={post.thumbnail_height}
                          sizes="172px"
                        />
                      ) : (
                        <img src={getYoutubeThumbnailUrl(post.youtube_id)} alt="" />
                      )}
                    </div>
                  )}
                  {post.board_type === 'feed' && post.image && (
                    <div className={styles.thumbnail}>
                      <OptimizedImage
                        src={post.image}
                        width={post.image_width}
                        height={post.image_height}
                        sizes="172px"
                      />
                    </div>
                  )}
                  {(post.board_type === 'basic' || post.board_type === 'blog') && post.thumbnail_image && (
                    <div className={styles.thumbnail}>
                      <OptimizedImage
                        src={post.thumbnail_image}
                        width={post.thumbnail_width}
                        height={post.thumbnail_height}
                        sizes="172px"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className={styles['description-item']}>
                    <div className={styles.description}>
                      <Box sx={{ mb: 1 }}>
                        <Chip
                          label={post.site_type === 'blog' ? '블로그' : '커뮤니티'}
                          size="small"
                          className="chip success"
                        />
                      </Box>
                      {post.board_type === 'gallery' && (
                        <div className={styles.info}>
                          <strong>{post.subject}</strong>
                          <p>{getDescriptionFromHTML(post.content_html)}</p>
                        </div>
                      )}
                      {post.board_type === 'youtube' && (
                        <div className={styles.info}>
                          <strong>{post.subject}</strong>
                          <p>{post.summary}</p>
                        </div>
                      )}
                      {post.board_type === 'feed' && (
                        <div className={styles.info}>
                          <p>{post.content_simple}</p>
                        </div>
                      )}
                      {(post.board_type === 'basic' || post.board_type === 'blog') && (
                        <div className={styles.info}>
                          <strong>{post.subject}</strong>
                          <p>{getDescriptionFromHTML(post.content_html)}</p>
                        </div>
                      )}
                    </div>
                    {post.board_type === 'gallery' && (
                      <div className={styles.thumbnail}>
                        <OptimizedImage
                          src={post.image}
                          width={post.image_width}
                          height={post.image_height}
                          sizes="172px"
                        />
                      </div>
                    )}
                    {post.board_type === 'youtube' && (
                      <div className={styles.thumbnail}>
                        {post.thumbnail_image ? (
                          <OptimizedImage
                            src={post.thumbnail_image}
                            width={post.thumbnail_width}
                            height={post.thumbnail_height}
                            sizes="172px"
                          />
                        ) : (
                          <img src={getYoutubeThumbnailUrl(post.youtube_id)} alt="" />
                        )}
                      </div>
                    )}
                    {post.board_type === 'feed' && post.image && (
                      <div className={styles.thumbnail}>
                        <OptimizedImage
                          src={post.image}
                          width={post.image_width}
                          height={post.image_height}
                          sizes="172px"
                        />
                      </div>
                    )}
                    {(post.board_type === 'basic' || post.board_type === 'blog') && post.thumbnail_image && (
                      <div className={styles.thumbnail}>
                        <OptimizedImage
                          src={post.thumbnail_image}
                          width={post.thumbnail_width}
                          height={post.thumbnail_height}
                          sizes="172px"
                        />
                      </div>
                    )}
                  </div>
                  <div className={styles.tail}>
                    <div className={styles['tail-container']}>
                      <AppIconAvatar site={post.site_type} src={post.profile_picture || null} alt="" size={24} />
                      <strong>{post.site_label}</strong>
                      <ScheduleRoundedIcon />
                      <time>{formatTimeAgo(post.published_at)}</time>
                    </div>
                  </div>
                </>
              )}
            </Anchor>
          </div>
        ))}
      </div>
    );
  }

  if (resolvedPostsData && orderType === 'hits') {
    return (
      <div className={`${styles.list} ${styles['list-hits']}`}>
        {resolvedPostsData.posts.map((post) => (
          <div
            key={`${post.site_key}-${post.board_key}-${post.slug || Math.random()}`}
            className={`paper paper-p0 ${styles.item}`}
          >
            <Anchor href={`${post.site_url}/${post.board_key}/${post.slug}`}>
              {post.board_type === 'gallery' && (
                <div className={styles.thumbnail}>
                  <OptimizedImage
                    src={post.image}
                    width={post.image_width}
                    height={post.image_height}
                    sizes="(max-width: 767px) 100vw, 342px"
                  />
                </div>
              )}
              {post.board_type === 'youtube' && (
                <div className={styles.thumbnail}>
                  {post.thumbnail_image ? (
                    <OptimizedImage
                      src={post.thumbnail_image}
                      width={post.thumbnail_width}
                      height={post.thumbnail_height}
                      sizes="(max-width: 767px) 100vw, 342px"
                    />
                  ) : (
                    <img src={getYoutubeThumbnailUrl(post.youtube_id)} alt="" />
                  )}
                </div>
              )}
              {post.board_type === 'feed' && (
                <div className={styles.thumbnail}>
                  {post.image ? (
                    <OptimizedImage
                      src={post.image}
                      width={post.image_width}
                      height={post.image_height}
                      sizes="(max-width: 767px) 100vw, 342px"
                    />
                  ) : post.promotion_image ? (
                    <img src={post.promotion_image} alt="" />
                  ) : (
                    <div className={styles.dummy} />
                  )}
                </div>
              )}
              {(post.board_type === 'basic' || post.board_type === 'blog') && (
                <div className={styles.thumbnail}>
                  {post.thumbnail_image ? (
                    <OptimizedImage
                      src={post.thumbnail_image}
                      width={post.thumbnail_width}
                      height={post.thumbnail_height}
                      sizes="(max-width: 767px) 100vw, 342px"
                    />
                  ) : post.promotion_image ? (
                    <img src={post.promotion_image} alt="" />
                  ) : (
                    <div className={styles.dummy} />
                  )}
                </div>
              )}
              <div className={styles['description-item']}>
                <div className={styles.description}>
                  {post.board_type === 'gallery' && (
                    <div className={styles.info}>
                      <strong>{post.subject}</strong>
                      <p>{getDescriptionFromHTML(post.content_html)}</p>
                    </div>
                  )}
                  {post.board_type === 'youtube' && (
                    <div className={styles.info}>
                      <strong>{post.subject}</strong>
                      <p>{post.summary}</p>
                    </div>
                  )}
                  {post.board_type === 'feed' && (
                    <div className={styles.info}>
                      <p>{post.content_simple}</p>
                    </div>
                  )}
                  {(post.board_type === 'basic' || post.board_type === 'blog') && (
                    <div className={styles.info}>
                      <strong>{post.subject}</strong>
                      <p>{getDescriptionFromHTML(post.content_html)}</p>
                    </div>
                  )}
                </div>
                <div className={styles.tail}>
                  <div className={styles['tail-site']}>
                    <AppIconAvatar site={post.site_type} src={post.profile_picture || null} alt="" size={24} />
                    <strong>{post.site_label}</strong>
                  </div>
                  <div className={styles['tail-author']}>
                    <Avatar
                      src={post.author_name ? post.author_avatar || '/broken-image.jpg' : undefined}
                      alt={post.author_name}
                      sx={{ width: 24, height: 24 }}
                    />
                    <strong>{post.author_name}</strong>
                  </div>
                  <div className={styles['tail-date']}>
                    <ScheduleRoundedIcon />
                    <time>{formatTimeAgo(post.published_at)}</time>
                    <VisibilityOutlinedIcon />
                    <time>{post.post_count}</time>
                  </div>
                </div>
              </div>
            </Anchor>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
