'use client';

import { useEffect, useState } from 'react';
import { formatDateSimple } from '@/lib/utils';
import Anchor from '@/components/Anchor';
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

type LikedResponse = {
  postLikes?: PostLikeRow[];
  commentLikes?: CommentLikeRow[];
  error?: string;
};

type Props = {
  siteType: SiteType;
};

export default function Liked({ siteType }: Props) {
  const [postLikes, setPostLikes] = useState<PostLikeRow[]>([]);
  const [commentLikes, setCommentLikes] = useState<CommentLikeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadLiked() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/hub/liked?siteType=${siteType}&limit=3`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as LikedResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '좋아요 목록을 불러오지 못했습니다.');
        }

        setPostLikes(Array.isArray(result.postLikes) ? result.postLikes : []);
        setCommentLikes(Array.isArray(result.commentLikes) ? result.commentLikes : []);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '좋아요 목록을 불러오지 못했습니다.');
        } else {
          setErrorMessage('좋아요 목록을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadLiked();
  }, [siteType]);

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

  return (
    <section className={`paper ${styles.paper} ${styles.likey}`}>
      <h2>좋아요 👍</h2>
      {postLikes.length === 0 && commentLikes.length === 0 ? (
        <p>하나도 맘에 든 글이 없으셨나봐요 😭</p>
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
