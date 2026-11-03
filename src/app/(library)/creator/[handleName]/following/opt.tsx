'use client';

import { useState } from 'react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import Anchor from '@/components/Anchor';
import ScreenState from '@/components/service/ScreenState';
import { ProfileForm } from '../opt';
import Profile from '../profile';
import CreatorTimelinePosts, { type CreatorTimelinePost } from '../timelinePosts';
import styles from '@/app/new.module.sass';

export type FollowingResponse = {
  posts: CreatorTimelinePost[];
  owner: {
    id: string;
    activityName: string;
    handleName: string;
    profileImage: string | null;
    coverImage: string | null;
    introduction: string | null;
    links: Array<{ id?: string; label: string; url: string }>;
    hasBranding: boolean;
    hasCreatorPosts: boolean;
    followingCount: number;
    followerCount: number;
  };
};

export default function Opt({
  initialData,
  initialError,
}: {
  initialData: FollowingResponse | null;
  initialError: string;
}) {
  const [data, setData] = useState(initialData);
  const [editing, setEditing] = useState(false);

  if (initialError) {
    return (
      <main className={`${styles['my-library']} ${styles['creator-following']}`}>
        <div className={styles.back}>
          <Anchor href="/creator/settings" className={styles.backlink}>
            <ArrowBackRoundedIcon />
            <span>작가의 서재로 돌아가기</span>
          </Anchor>
        </div>
        <div className={styles['user-cover']} />
        <div className={styles.container}>
          <div className={`content ${styles.content} ${styles['content-error']}`}>
            <ScreenState kind="error">{initialError}</ScreenState>
          </div>
        </div>
      </main>
    );
  }

  if (!data) return null;

  const { owner, posts } = data;
  return (
    <Profile
      creator={owner}
      currentMenu="following"
      canUseSeriesPosts={owner.hasCreatorPosts}
      isOwner
      canUseCreatorLibrary
      hasBranding={owner.hasBranding}
      isEditing={editing}
      editingContent={
        <ProfileForm
          profile={owner}
          onCancel={() => setEditing(false)}
          onSaved={(next) => {
            setData((current) => (current ? { ...current, owner: { ...current.owner, ...next } } : current));
            setEditing(false);
          }}
        />
      }
      onEdit={() => setEditing(true)}
    >
      <CreatorTimelinePosts posts={posts} emptyMessage="팔로우한 작가의 글이 없습니다." />
    </Profile>
  );
}
