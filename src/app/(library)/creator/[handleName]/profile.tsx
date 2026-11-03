'use client';

import type { ReactNode } from 'react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { Avatar, Typography } from '@mui/material';
import Anchor from '@/components/Anchor';
import styles from '@/app/new.module.sass';

export type CreatorProfile = {
  id?: string;
  handleName: string;
  coverImage: string | null;
  introduction: string | null;
  links: Array<{ id?: string; label: string; url: string }>;
  activityName: string;
  profileImage: string | null;
  followingCount: number;
  followerCount: number;
};

type Menu = 'all' | 'series' | 'following' | 'followers';

type Props = {
  creator: CreatorProfile;
  currentMenu: Menu;
  canUseSeriesPosts: boolean;
  isOwner: boolean;
  canUseCreatorLibrary: boolean;
  viewerCreatorHandleName?: string | null;
  hasBranding?: boolean;
  isEditing?: boolean;
  editingContent?: ReactNode;
  following?: boolean;
  followSubmitting?: boolean;
  onEdit?: () => void;
  onToggleFollow?: () => void;
  onMenuChange?: (menu: 'all' | 'series') => void;
  children: ReactNode;
};

export default function Profile({
  creator,
  currentMenu,
  canUseSeriesPosts,
  isOwner,
  canUseCreatorLibrary,
  viewerCreatorHandleName = null,
  hasBranding = false,
  isEditing = false,
  editingContent,
  following = false,
  followSubmitting = false,
  onEdit,
  onToggleFollow,
  onMenuChange,
  children,
}: Props) {
  const followingHref = `/creator/${creator.handleName}/following`;
  const backHref = !isOwner && viewerCreatorHandleName ? `/creator/${viewerCreatorHandleName}` : '/';
  const backLabel = !isOwner && viewerCreatorHandleName ? '나의 서재로 돌아가기' : '라운지로 돌아가기';

  function renderPostMenu(menu: 'all' | 'series', label: string) {
    const href = menu === 'all' ? `/creator/${creator.handleName}` : `/creator/${creator.handleName}?tab=series`;
    const isCurrent = currentMenu === menu;

    return (
      <li className={isCurrent ? styles.current : undefined} aria-current={isCurrent ? 'page' : undefined}>
        {onMenuChange ? (
          <button type="button" onClick={() => onMenuChange(menu)}>
            {label}
          </button>
        ) : (
          <Anchor href={href} aria-current={isCurrent ? 'page' : undefined}>
            {label}
          </Anchor>
        )}
      </li>
    );
  }

  return (
    <main className={styles['my-library']}>
      <div className={styles.back}>
        <Anchor href={backHref} className={styles.backlink}>
          <ArrowBackRoundedIcon />
          <span>{backLabel}</span>
        </Anchor>
      </div>
      <div className={`${styles['user-cover']} ${creator.coverImage ? styles['user-cover-image-container'] : ''}`}>
        {creator.coverImage ? (
          <div className={styles['user-cover-image']} style={{ backgroundImage: `url(${creator.coverImage})` }}>
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
                <Avatar
                  src={creator.profileImage ?? undefined}
                  alt={creator.activityName}
                  sx={{ width: 72, height: 72 }}
                >
                  {creator.activityName.slice(0, 1)}
                </Avatar>
                <div className={styles['user-bio-title-row']}>
                  <div className={styles['user-bio-name']}>
                    <h1>{creator.activityName} 작가</h1>
                    <Typography variant="subtitle2">@{creator.handleName}</Typography>
                  </div>
                  {isOwner && hasBranding && onEdit ? (
                    <div className={styles['user-bio-action']}>
                      <button type="button" className="button small action" onClick={onEdit}>
                        프로필 수정
                      </button>
                    </div>
                  ) : null}
                  {!isOwner && canUseCreatorLibrary && onToggleFollow ? (
                    <div className={styles['user-bio-action']}>
                      <button
                        type="button"
                        className="button small action"
                        disabled={followSubmitting}
                        onClick={onToggleFollow}
                      >
                        {followSubmitting ? '처리 중' : following ? '팔로우 취소하기' : '팔로우하기'}
                      </button>
                    </div>
                  ) : null}
                </div>
                {creator.introduction ? (
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {creator.introduction}
                  </Typography>
                ) : null}
                {creator.links.length ? (
                  <ul className={styles['user-bio-links']}>
                    {creator.links.map((link) => (
                      <li key={link.id ?? link.url}>
                        <Anchor href={link.url}>{link.label}</Anchor>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {creator.followingCount || creator.followerCount ? (
                  <div className={styles['user-bio-follows']}>
                    <dl>
                      {creator.followingCount ? (
                        <div>
                          <dt>작가 팔로잉</dt>
                          <dd>{creator.followingCount}명</dd>
                        </div>
                      ) : null}
                      {creator.followerCount ? (
                        <div>
                          <dt>작가 팔로워</dt>
                          <dd>{creator.followerCount}명</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                ) : null}
              </>
            )}
          </div>
          <div className={styles.tabs}>
            <ul className="content">
              {renderPostMenu('all', '전체글')}
              {canUseSeriesPosts ? renderPostMenu('series', '연재글') : null}
              {isOwner && canUseCreatorLibrary ? (
                <li className={currentMenu === 'following' ? styles.current : undefined}>
                  <Anchor href={followingHref} aria-current={currentMenu === 'following' ? 'page' : undefined}>
                    작가들의 서재
                  </Anchor>
                </li>
              ) : !isOwner ? (
                <li className={currentMenu === 'followers' ? styles.current : undefined}>
                  <Anchor
                    href={`/creator/${creator.handleName}/followers`}
                    aria-current={currentMenu === 'followers' ? 'page' : undefined}
                  >
                    팔로잉한 서재
                  </Anchor>
                </li>
              ) : null}
            </ul>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
