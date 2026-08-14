'use client';

import { Avatar, useMediaQuery, useTheme } from '@mui/material';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { formatTimeAgo } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';
import { ListProps } from '../page';
import styles from '@/app/page.module.sass';

export default function List({ postsData, orderType }: ListProps) {
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

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

  if (postsData && orderType === 'newest') {
    return (
      <div className={`${styles.list} ${styles['list-newest']}`}>
        {postsData.posts.map((post) => (
          <div key={`${post.site_key}-${post.board_key}-${post.slug || Math.random()}`} className={`paper ${styles.item}`}>
            <Anchor href={post.slug ? `/${post.site_key}/${post.board_key}/${post.slug}` : '#'}>
              {isMobile ? (
                <div className={`${styles['description-item']} ${styles['description-item-mini']}`}>
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
                    <div className={styles.tail}>
                      <div className={styles['tail-author']}>
                        <Avatar
                          src={post.author_avatar ?? undefined}
                          alt={post.author_name}
                          sx={{ width: 24, height: 24, fontSize: 12 }}
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
                      <img src={post.image} alt="" />
                    </div>
                  )}
                  {post.board_type === 'youtube' && (
                    <div className={styles.thumbnail}>
                      <img
                        src={post.thumbnail_image ? post.thumbnail_image : getYoutubeThumbnailUrl(post.youtube_id)}
                        alt=""
                      />
                    </div>
                  )}
                  {post.board_type === 'feed' && post.image && (
                    <div className={styles.thumbnail}>
                      <img src={post.image} alt="" />
                    </div>
                  )}
                  {(post.board_type === 'basic' || post.board_type === 'blog') && post.thumbnail_image && (
                    <div className={styles.thumbnail}>
                      <img src={post.thumbnail_image} alt="" />
                    </div>
                  )}
                </div>
              ) : (
                <>
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
                    {post.board_type === 'gallery' && (
                      <div className={styles.thumbnail}>
                        <img src={post.image} alt="" />
                      </div>
                    )}
                    {post.board_type === 'youtube' && (
                      <div className={styles.thumbnail}>
                        <img
                          src={post.thumbnail_image ? post.thumbnail_image : getYoutubeThumbnailUrl(post.youtube_id)}
                          alt=""
                        />
                      </div>
                    )}
                    {post.board_type === 'feed' && post.image && (
                      <div className={styles.thumbnail}>
                        <img src={post.image} alt="" />
                      </div>
                    )}
                    {(post.board_type === 'basic' || post.board_type === 'blog') && post.thumbnail_image && (
                      <div className={styles.thumbnail}>
                        <img src={post.thumbnail_image} alt="" />
                      </div>
                    )}
                  </div>
                  <div className={styles.tail}>
                    <div className={styles['tail-container']}>
                      <AppIconAvatar src={post.profile_picture || null} alt="" size={24} />
                      <strong>{post.site_label}</strong>
                      <em>by</em>
                      <Avatar
                        src={post.author_avatar ?? undefined}
                        alt={post.author_name}
                        sx={{ width: 24, height: 24, fontSize: 12 }}
                      />
                      <strong>{post.author_name}</strong>
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

  if (postsData && orderType === 'hits') {
    return (
      <div className={`${styles.list} ${styles['list-hits']}`}>
        {postsData.posts.map((post) => (
          <div key={`${post.site_key}-${post.board_key}-${post.slug || Math.random()}`} className={`paper paper-p0 ${styles.item}`}>
            <Anchor href={post.slug ? `/${post.site_key}/${post.board_key}/${post.slug}` : '#'}>
              {post.board_type === 'gallery' && (
                <div className={styles.thumbnail}>
                  <img src={post.image} alt="" />
                </div>
              )}
              {post.board_type === 'youtube' && (
                <div className={styles.thumbnail}>
                  <img
                    src={post.thumbnail_image ? post.thumbnail_image : getYoutubeThumbnailUrl(post.youtube_id)}
                    alt=""
                  />
                </div>
              )}
              {post.board_type === 'feed' && (
                <div className={styles.thumbnail}>
                  {post.image ? (
                    <img src={post.image} alt="" />
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
                    <img src={post.thumbnail_image} alt="" />
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
                      src={post.author_avatar ?? undefined}
                      alt={post.author_name}
                      sx={{ width: 24, height: 24, fontSize: 12 }}
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
