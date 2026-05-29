'use client';

import { useEffect, useState } from 'react';
import Anchor from '@/components/Anchor';
import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';
import styles from '@/app/hub.module.sass';

type FavoriteBlogRow = {
  id: string;
  siteName: string;
  siteLabel: string;
  visibilityType: string;
  visibilityLabel: string;
  isShutdown: boolean;
  profilePictureUrl: string | null;
  profileLogoUrl: string | null;
  href: string;
  favoritedAt: string;
};

type FavoriteBlogsResponse = {
  blogs?: FavoriteBlogRow[];
  error?: string;
};

export default function FavoriteBlogs() {
  const [blogs, setBlogs] = useState<FavoriteBlogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadFavoriteBlogs() {
      try {
        setErrorMessage('');

        const response = await fetch('/api/hub/blog-favorites', {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as FavoriteBlogsResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '즐겨찾는 블로그 목록을 불러오지 못했습니다.');
        }

        setBlogs(Array.isArray(result.blogs) ? result.blogs : []);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '즐겨찾는 블로그 목록을 불러오지 못했습니다.');
        } else {
          setErrorMessage('즐겨찾는 블로그 목록을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadFavoriteBlogs();
  }, []);

  if (isLoading) {
    return null;
  }

  if (errorMessage) {
    return (
      <section className={`paper ${styles.paper}`}>
        <p>{errorMessage}</p>
      </section>
    );
  }

  if (blogs.length === 0) {
    return null;
  }

  return (
    <section className={`paper ${styles.paper} ${styles.join}`}>
      <h2>즐겨찾는 블로그</h2>

      <div className={styles['join-sites']}>
        {blogs.map((blog) => (
          <div key={blog.id} className={styles['join-site']}>
            <div className={styles['join-site-info']}>
              <div className={styles['site-name']}>
                {blog.profileLogoUrl ? (
                  <img src={blog.profileLogoUrl} alt="" />
                ) : (
                  <>
                    <AppIconAvatar src={blog.profilePictureUrl || null} alt={blog.siteLabel} size={58} />
                    <strong>{blog.siteLabel}</strong>
                  </>
                )}
                <em>
                  {blog.visibilityLabel} {blog.isShutdown ? '(운영중지)' : null}
                </em>
              </div>

              <Anchor href={blog.href} className="button action small">
                블로그 이동
              </Anchor>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
