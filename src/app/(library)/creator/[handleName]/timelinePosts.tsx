'use client';

import type { ReactNode } from 'react';
import { Avatar } from '@mui/material';
import { formatTimeAgo } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import ScreenState from '@/components/service/ScreenState';
import YoutubeEmbed from '@/components/service/YoutubeEmbed';
import styles from '@/app/new.module.sass';

export type CreatorTimelinePost = {
  id: string;
  url: string;
  publishedAt: string | null;
  boardType: 'basic' | 'blog' | 'feed' | 'gallery' | 'youtube';
  content: string;
  image: string | null;
  youtubeId: string | null;
  creator: {
    activityName: string;
    handleName: string;
    profileImage: string | null;
  };
};

function openPost(url: string) {
  window.open(
    url,
    'creator-post',
    [
      'popup=yes',
      'width=960',
      'height=760',
      'left=80',
      'top=80',
      'resizable=yes',
      'scrollbars=yes',
      'toolbar=no',
      'menubar=no',
      'location=no',
      'status=no',
    ].join(','),
  );
}

function FeedContent({ content }: { content: string }) {
  const parts = content.split(/(https?:\/\/[^\s<>'"]+)/g);

  return (
    <p>
      {parts.map((part, index): ReactNode => {
        if (!/^https?:\/\//.test(part)) return part;

        return (
          <Anchor key={`${part}-${index}`} href={part}>
            {part}
          </Anchor>
        );
      })}
    </p>
  );
}

function PostContent({ post }: { post: CreatorTimelinePost }) {
  return (
    <div className={styles['creator-following-content']}>
      {post.boardType === 'gallery' && post.image ? <img src={post.image} alt="" /> : null}
      {post.boardType === 'youtube' && post.youtubeId ? <YoutubeEmbed videoId={post.youtubeId} /> : null}
      {post.content ? post.boardType === 'feed' ? <FeedContent content={post.content} /> : <p>{post.content}</p> : null}
    </div>
  );
}

export default function CreatorTimelinePosts({
  posts,
  emptyMessage,
  returnToUserHandle,
}: {
  posts: CreatorTimelinePost[];
  emptyMessage: string;
  returnToUserHandle?: string | null;
}) {
  if (!posts.length) return <ScreenState>{emptyMessage}</ScreenState>;

  return (
    <ul className={`paper ${styles['creator-following-posts']}`}>
      {posts.map((post) => (
        <li key={post.id}>
          <Anchor
            href={`/creator/${post.creator.handleName}${returnToUserHandle ? `?fromUser=${encodeURIComponent(returnToUserHandle)}` : ''}`}
            className={styles['creator-following-profile']}
          >
            <Avatar
              src={post.creator.activityName ? post.creator.profileImage || '/broken-image.jpg' : undefined}
              alt={post.creator.activityName || ''}
            />
            <div className={styles.user}>
              <strong>{post.creator.activityName} 작가</strong>
              <em>@{post.creator.handleName}</em>
            </div>
          </Anchor>
          <PostContent post={post} />
          <button type="button" className={styles['creator-following-time']} onClick={() => openPost(post.url)}>
            <time>{formatTimeAgo(post.publishedAt)}</time>
          </button>
        </li>
      ))}
    </ul>
  );
}
