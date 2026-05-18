'use client';

import { useEffect, useState } from 'react';
import { formatDateSimple } from '@/lib/utils';

import Anchor from '@/components/Anchor';
import styles from '@/app/hub.module.sass';

type SiteType = 'blog' | 'community';
type HistoryType = 'read' | 'saved';

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
  type: HistoryType;
};

function getApiPath(type: HistoryType) {
  return type === 'read' ? '/api/hub/read-posts' : '/api/hub/saved-posts';
}

function getTitle(type: HistoryType) {
  return type === 'read' ? `읽은 글` : `저장한 글`;
}

function getDateLabel(type: HistoryType) {
  return type === 'read' ? '읽은 날짜' : '저장한 날짜';
}

export default function PostHistory({ siteType, type }: Props) {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadPosts() {
      try {
        setErrorMessage('');

        const response = await fetch(`${getApiPath(type)}?siteType=${siteType}&limit=3`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as PostsResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '글 목록을 불러오지 못했습니다.');
        }

        setPosts(Array.isArray(result.posts) ? result.posts : []);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '글 목록을 불러오지 못했습니다.');
        } else {
          setErrorMessage('글 목록을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadPosts();
  }, [siteType, type]);

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

  if (posts.length === 0) {
    return null;
  }

  return (
    <section className={`paper ${styles.paper} ${styles.history}`}>
      <h2>{getTitle(type)}</h2>
      {posts.length === 0 ? (
        <p>좋은 글, 좋은 생각.</p>
      ) : (
        <div className={styles.items}>
          <ol>
            {posts.map((post) => (
              <li key={post.id}>
                <Anchor href={post.href}>
                  <strong aria-label="글 제목">{post.title}</strong>
                  <cite aria-label="작성자">{post.authorName}</cite>
                  <div className={styles.tail}>
                    <em aria-label="사이트명">{post.siteName}</em>
                    <time aria-label={getDateLabel(type)}>{formatDateSimple(post.date)}</time>
                  </div>
                </Anchor>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
