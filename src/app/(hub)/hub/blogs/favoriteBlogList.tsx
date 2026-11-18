'use client';

import { useEffect, useState } from 'react';
import {
  type FavoriteBlogsResponse,
  getFolderBlogs,
  sortFavoriteBlogs,
  sortFavoriteFolders,
  waitForFavoriteRequests,
} from '@/lib/service/hubFavoriteFolder.shared';
import ScreenState from '@/components/service/ScreenState';
import FavoriteBlogCard from './favoriteBlogCard';
import styles from '@/app/hub.module.sass';

type Props = {
  initialData: FavoriteBlogsResponse | null;
  initialError: string;
};

export default function FavoriteBlogList({ initialData, initialError }: Props) {
  const [data, setData] = useState<FavoriteBlogsResponse | null>(initialData);
  const [errorMessage, setErrorMessage] = useState(initialError);

  useEffect(() => {
    let isActive = true;

    const loadData = async () => {
      try {
        await waitForFavoriteRequests();
        const response = await fetch('/api/hub/blog-favorites', { credentials: 'include', cache: 'no-store' });
        const result = (await response.json()) as FavoriteBlogsResponse;

        if (!response.ok) throw new Error(result.error ?? '즐겨찾는 블로그를 불러오지 못했습니다.');
        if (!isActive) return;

        setData(result);
        setErrorMessage('');
      } catch (unknownError) {
        if (!isActive) return;

        setErrorMessage(
          unknownError instanceof Error ? unknownError.message : '즐겨찾는 블로그를 불러오지 못했습니다.',
        );
      }
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void loadData();
    };

    void loadData();
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      isActive = false;
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  if (errorMessage)
    return (
      <section className={`paper ${styles.paper}`}>
        <ScreenState kind="error">{errorMessage}</ScreenState>
      </section>
    );

  const blogs = data?.blogs ?? [];
  const folders = sortFavoriteFolders(data?.folders ?? []);

  if (blogs.length === 0) return null;

  return (
    <section className={`paper ${styles.paper} ${styles.join}`}>
      <h2>즐겨찾기</h2>
      {data?.canUseFolders ? (
        <div className={styles['hub-list-groups']}>
          {folders.map((folder) => {
            const folderBlogs = getFolderBlogs(blogs, folder.id);

            return (
              <div key={folder.id}>
                <h3>{folder.label}</h3>
                {folderBlogs.length > 0 ? (
                  <div className={`${styles.list} ${styles['list-newest']}`}>
                    {folderBlogs.map((blog) => (
                      <FavoriteBlogCard key={blog.id} blog={blog} />
                    ))}
                  </div>
                ) : (
                  <ScreenState>항목이 없습니다.</ScreenState>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`${styles.list} ${styles['list-newest']}`}>
          {sortFavoriteBlogs(blogs, folders).map((blog) => (
            <FavoriteBlogCard key={blog.id} blog={blog} />
          ))}
        </div>
      )}
    </section>
  );
}
