'use client';

import { useEffect, useState } from 'react';
import { formatDateSimple } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import styles from '@/app/hub.module.sass';

type SiteType = 'blog' | 'community';

type PostRow = {
  id: string;
  title: string;
  authorName: string;
  siteName: string;
  date: string;
  href: string;
};

type PostsResponse = {
  posts?: PostRow[];
  error?: string;
};

type Props = {
  siteType: SiteType;
};

export default function SavedItems({ siteType }: Props) {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadPosts() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/hub/saved-posts?siteType=${siteType}&limit=100`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as PostsResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '저장한 글 목록을 불러오지 못했습니다.');
        }

        setPosts(Array.isArray(result.posts) ? result.posts : []);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '저장한 글 목록을 불러오지 못했습니다.');
        } else {
          setErrorMessage('저장한 글 목록을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadPosts();
  }, [siteType]);

  if (isLoading) {
    return null;
  }

  return (
    <section className={`paper ${styles.paper} ${styles.history}`}>
      <h2>보고 또 보고 👉</h2>

      {errorMessage ? <p>{errorMessage}</p> : null}

      {!errorMessage && posts.length > 0 ? (
        <div className={styles.items}>
          <ol>
            {posts.map((post) => (
              <li key={post.id}>
                <Anchor href={post.href}>
                  <strong aria-label="글 제목">{post.title}</strong>
                  <cite aria-label="작성자">{post.authorName}</cite>
                  <div className={styles.tail}>
                    <em aria-label="사이트명">{post.siteName}</em>
                    <time aria-label="저장한 날짜">{formatDateSimple(post.date)}</time>
                  </div>
                </Anchor>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {!errorMessage && posts.length === 0 ? <p>저장한 글이 없습니다.</p> : null}
    </section>
  );
}
