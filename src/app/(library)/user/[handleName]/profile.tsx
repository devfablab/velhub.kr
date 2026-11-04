'use client';

import type { ReactNode } from 'react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { Avatar, Typography } from '@mui/material';
import Anchor from '@/components/Anchor';
import styles from '@/app/new.module.sass';

export type ReaderProfile = {
  id?: string;
  handleName: string;
  coverImage: string | null;
  introduction: string | null;
  activityName: string;
  profileImage: string | null;
};

type Props = {
  user: ReaderProfile;
  currentMenu: 'all' | 'following';
  isOwner: boolean;
  hasFollowingLibraries: boolean;
  isEditing?: boolean;
  editingContent?: ReactNode;
  onEdit?: () => void;
  children: ReactNode;
};

export default function Profile({
  user,
  currentMenu,
  isOwner,
  hasFollowingLibraries,
  isEditing = false,
  editingContent,
  onEdit,
  children,
}: Props) {
  function renderMenu(menu: 'all' | 'following', label: string) {
    const isCurrent = currentMenu === menu;
    const href = menu === 'all' ? `/user/${user.handleName}` : `/user/${user.handleName}/following`;

    return (
      <li className={isCurrent ? styles.current : undefined} aria-current={isCurrent ? 'page' : undefined}>
        <Anchor href={href}>{label}</Anchor>
      </li>
    );
  }

  return (
    <main className={styles['my-library']}>
      <div className={styles.back}>
        <Anchor href="/" className={styles.backlink}>
          <ArrowBackRoundedIcon />
          <span>라운지로 돌아가기</span>
        </Anchor>
      </div>
      <div className={`${styles['user-cover']} ${user.coverImage ? styles['user-cover-image-container'] : ''}`}>
        {user.coverImage ? (
          <div className={styles['user-cover-image']} style={{ backgroundImage: `url(${user.coverImage})` }}>
            <div className={styles['dummy-before']} />
            <div className={styles['dummy-after']} />
          </div>
        ) : null}
      </div>
      <div className={styles.container}>
        <div className={`content ${styles.content}`}>
          <div className={styles['user-bio']}>
            {isEditing && isOwner ? (
              editingContent
            ) : (
              <>
                <Avatar src={user.profileImage ?? undefined} alt={user.activityName} sx={{ width: 72, height: 72 }}>
                  {user.activityName.slice(0, 1)}
                </Avatar>
                <div className={styles['user-bio-title-row']}>
                  <div className={styles['user-bio-name']}>
                    <h1>{user.activityName}</h1>
                    <Typography variant="subtitle2">@{user.handleName}</Typography>
                  </div>
                  {isOwner && onEdit ? (
                    <div className={styles['user-bio-action']}>
                      <button type="button" className="button small action" onClick={onEdit}>
                        프로필 수정
                      </button>
                    </div>
                  ) : null}
                </div>
                {user.introduction ? (
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {user.introduction}
                  </Typography>
                ) : null}
              </>
            )}
          </div>
          {hasFollowingLibraries ? (
            <div className={styles.tabs}>
              <ul className="content">
                {renderMenu('all', '전체글')}
                {renderMenu('following', isOwner ? '작가들의 서재' : '팔로잉한 서재')}
              </ul>
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </main>
  );
}
