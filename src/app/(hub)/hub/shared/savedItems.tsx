'use client';

import { HubPostDisplay } from '@/lib/service/hub/postDisplay';
import { formatDateSimple } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import AiUsageChip from '@/components/service/blog/AiUsageChip';
import ScreenState from '@/components/service/ScreenState';
import { ServiceNoDataIcon } from '@/components/Svgs';
import styles from '@/app/hub.module.sass';

type SiteType = 'blog' | 'community';

type PostRow = {
  id: string;
  date: string;
  post: HubPostDisplay;
};

export type SavedResponse = {
  posts?: PostRow[];
  error?: string;
};

type Props = {
  siteType: SiteType;
  initialData: SavedResponse | null;
  initialError: string;
};

export default function SavedItems({ initialData, initialError }: Props) {
  const posts = Array.isArray(initialData?.posts) ? initialData.posts : [];

  return (
    <section className={`paper ${styles.paper} ${styles.history}`}>
      <h2>보고 또 보고 👉</h2>

      {initialError ? <ScreenState kind="error">{initialError}</ScreenState> : null}

      {!initialError && posts.length > 0 ? (
        <div className={styles.items}>
          <ol>
            {posts.map((post) => (
              <li key={post.id}>
                <Anchor href={post.post.href} className="paper">
                  <div>
                    <AiUsageChip value={post.post.aiUsage} />
                  </div>
                  <strong aria-label="글 제목">{post.post.subject}</strong>
                  <cite aria-label="작성자">{post.post.authorName}</cite>
                  <div className={styles.tail}>
                    <em aria-label="사이트명">{post.post.siteName}</em>
                    <time aria-label="저장한 날짜">{formatDateSimple(post.date)}</time>
                  </div>
                </Anchor>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {!initialError && posts.length === 0 ? (
        <div className="paper page-info">
          <ServiceNoDataIcon />
          <p>저장한 글이 없습니다.</p>
        </div>
      ) : null}
    </section>
  );
}
