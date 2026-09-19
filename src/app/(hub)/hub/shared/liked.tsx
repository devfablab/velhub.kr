'use client';

import { formatDateSimple } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import ScreenState from '@/components/service/ScreenState';
import styles from '@/app/hub.module.sass';

type SiteType = 'blog' | 'community';

type PostLikeRow = {
  id: string;
  title: string;
  authorName: string;
  siteName: string;
  likedAt: string;
  href: string;
};

type CommentLikeRow = {
  id: string;
  comment: string;
  postTitle: string;
  siteName: string;
  likedAt: string;
  href: string;
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
        <div className={`paper ${styles['likey-sites']}`}>
          {postLikes.length > 0 ? (
            <div className={styles.items}>
              <h3>좋은 글</h3>
              <ol>
                {postLikes.map((post) => (
                  <li key={post.id}>
                    <Anchor href={post.href}>
                      <strong aria-label="글 제목">{post.title}</strong>
                      <cite aria-label="작성자">{post.authorName}</cite>
                      <div className={styles.tail}>
                        <em aria-label="사이트명">{post.siteName}</em>
                        <time aria-label="좋아요 누른 일시">{formatDateSimple(post.likedAt)}</time>
                      </div>
                    </Anchor>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {commentLikes.length > 0 ? (
            <div className={styles.items}>
              <h3>좋은 댓글</h3>
              <ol>
                {commentLikes.map((comment) => (
                  <li key={comment.id}>
                    <Anchor href={comment.href}>
                      <p aria-label="댓글">{comment.comment}</p>
                      <strong aria-label="글 제목">{comment.postTitle}</strong>
                      <div className={styles.tail}>
                        <em aria-label="사이트명">{comment.siteName}</em>
                        <time aria-label="좋아요 누른 일시">{formatDateSimple(comment.likedAt)}</time>
                      </div>
                    </Anchor>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
