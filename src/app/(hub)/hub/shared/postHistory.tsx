'use client';

import { formatDateSimple } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import ScreenState from '@/components/service/ScreenState';
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

export type PostsResponse = {
  posts?: PostRow[];
  error?: string;
};

type Props = {
  siteType: SiteType;
  type: HistoryType;
  initialData: PostsResponse | null;
  initialError: string;
};

function getTitle(type: HistoryType) {
  return type === 'read' ? `읽은 글` : `저장한 글`;
}

function getDateLabel(type: HistoryType) {
  return type === 'read' ? '읽은 날짜' : '저장한 날짜';
}

export default function PostHistory({ type, initialData, initialError }: Props) {
  const posts = Array.isArray(initialData?.posts) ? initialData.posts : [];

  if (initialError) {
    return (
      <section className={`paper ${styles.paper}`}>
        <ScreenState kind="error">{initialError}</ScreenState>
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
