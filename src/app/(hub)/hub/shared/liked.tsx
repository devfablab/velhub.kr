'use client';

import type { HubPostDisplay } from '@/lib/service/hub/postDisplay';
import ScreenState from '@/components/service/ScreenState';
import HubPostListItem from './HubPostListItem';
import styles from '@/app/hub.module.sass';

type SiteType = 'blog' | 'community';

type PostLikeRow = {
  id: string;
  likedAt: string;
  post: HubPostDisplay;
};

type CommentLikeRow = {
  id: string;
  comment: string;
  likedAt: string;
  post: HubPostDisplay;
};

export type LikedResponse = {
  postLikes?: PostLikeRow[];
  commentLikes?: CommentLikeRow[];
  error?: string;
};

type Props = {
  siteType: SiteType;
  initialData: LikedResponse | null;
  initialError: string;
};

export default function Liked({ initialData, initialError }: Props) {
  const postLikes = Array.isArray(initialData?.postLikes) ? initialData.postLikes : [];
  const commentLikes = Array.isArray(initialData?.commentLikes) ? initialData.commentLikes : [];

  if (initialError) {
    return (
      <section className={`paper ${styles.paper}`}>
        <ScreenState kind="error">{initialError}</ScreenState>
      </section>
    );
  }

  return (
    <section className={`paper ${styles.paper} ${styles.likey}`}>
      <h2>좋아요 👍</h2>
      {postLikes.length === 0 && commentLikes.length === 0 ? (
        <ScreenState>하나도 맘에 든 글이 없으셨나봐요 😭</ScreenState>
      ) : (
        <div className={styles['hub-list-groups']}>
          {postLikes.length > 0 ? (
            <div>
              <h3>포스팅</h3>
              <ol className={`${styles.list} ${styles['list-newest']} paper`}>
                {postLikes.map((post) => (
                  <HubPostListItem key={post.id} post={post.post} date={post.likedAt} dateLabel="좋아요 누른 일시" />
                ))}
              </ol>
            </div>
          ) : null}

          {commentLikes.length > 0 ? (
            <div>
              <h3>댓글</h3>
              <ol className={`${styles.list} ${styles['list-newest']} paper`}>
                {commentLikes.map((comment) => (
                  <HubPostListItem
                    key={comment.id}
                    post={comment.post}
                    date={comment.likedAt}
                    dateLabel="좋아요 누른 일시"
                    description={comment.comment}
                  />
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
