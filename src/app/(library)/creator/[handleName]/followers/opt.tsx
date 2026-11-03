'use client';

import { useState } from 'react';
import { Avatar, Stack, Typography } from '@mui/material';
import Anchor from '@/components/Anchor';
import ScreenState from '@/components/service/ScreenState';
import Profile from '../profile';
import styles from '@/app/new.module.sass';

export type FollowersResponse = {
  owner: {
    id: string;
    activityName: string;
    handleName: string;
    profileImage: string | null;
    coverImage: string | null;
    introduction: string | null;
    links: Array<{ id: string; label: string; url: string }>;
    hasBranding: boolean;
    hasCreatorPosts: boolean;
    followingCount: number;
    followerCount: number;
  };
  libraries: Array<{
    id: string;
    activityName: string;
    handleName: string;
    profileImage: string | null;
    introduction: string | null;
  }>;
  isOwner: boolean;
  canUseSeriesPosts: boolean;
  canUseCreatorLibrary: boolean;
  viewerCreatorHandleName: string | null;
  isFollowing: boolean;
};

export default function Opt({
  initialData,
  initialError,
}: {
  initialData: FollowersResponse | null;
  initialError: string;
}) {
  const [data, setData] = useState(initialData);
  const [message, setMessage] = useState(initialError);
  const [followSubmitting, setFollowSubmitting] = useState(false);

  if (message) {
    return <ScreenState kind="error">{message}</ScreenState>;
  }
  if (!data) return null;

  const toggleFollow = async () => {
    if (followSubmitting) return;

    setFollowSubmitting(true);
    try {
      const response = await fetch(`/api/creator/${data.owner.handleName}/follow`, {
        method: data.isFollowing ? 'DELETE' : 'POST',
      });
      const payload = (await response.json()) as { isFollowing?: boolean; message?: string };
      if (!response.ok) throw new Error(payload.message ?? '서재 팔로우를 변경하지 못했습니다.');
      setData((current) => (current ? { ...current, isFollowing: Boolean(payload.isFollowing) } : current));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '서재 팔로우를 변경하지 못했습니다.');
    } finally {
      setFollowSubmitting(false);
    }
  };

  return (
    <Profile
      creator={data.owner}
      currentMenu="followers"
      canUseSeriesPosts={data.canUseSeriesPosts}
      isOwner={data.isOwner}
      canUseCreatorLibrary={data.canUseCreatorLibrary}
      viewerCreatorHandleName={data.viewerCreatorHandleName}
      hasBranding={data.owner.hasBranding}
      following={data.isFollowing}
      followSubmitting={followSubmitting}
      onToggleFollow={toggleFollow}
    >
      {data.libraries.length ? (
        <ul className={`paper ${styles['creator-followed-libraries']}`}>
          {data.libraries.map((library) => (
            <li key={library.id}>
              <Anchor href={`/creator/${library.handleName}`}>
                <Avatar src={library.profileImage ?? undefined} alt={library.activityName}>
                  {library.activityName.slice(0, 1)}
                </Avatar>
                <div className={styles.user}>
                  <strong>{library.activityName} 작가</strong> <em>@{library.handleName}</em>
                </div>
              </Anchor>
            </li>
          ))}
        </ul>
      ) : (
        <ScreenState>팔로잉한 서재가 없습니다.</ScreenState>
      )}
    </Profile>
  );
}
