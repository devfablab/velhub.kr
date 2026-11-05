'use client';

import type { HubPostDisplay } from '@/lib/service/hub/postDisplay';
import ScreenState from '@/components/service/ScreenState';
import HubPostListItem from './HubPostListItem';
import styles from '@/app/hub.module.sass';

type SiteType = 'blog' | 'community';
type HistoryType = 'read' | 'saved';

type PostRow = {
  id: string;
  date: string;
  post: HubPostDisplay;
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
        <div>
          <ol className={`${styles.list} ${styles['list-newest']}`}>
            {posts.map((post) => (
              <HubPostListItem key={post.id} post={post.post} date={post.date} dateLabel={getDateLabel(type)} />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
