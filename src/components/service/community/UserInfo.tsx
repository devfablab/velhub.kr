'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useParams } from 'next/navigation';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import { DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { formatDate, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import styles from '@/app/aside.module.sass';

type UserInfoStatus = 'guest' | 'not_joined' | 'pending' | 'blocked' | 'active';

type ManagerRoleItem = {
  role: string;
  label: string;
};

type UserInfoData = {
  avatarUrl: string;
  activityName: string;
  nickname: string;
  joinedAt: string;
  postCount: number;
  commentCount: number;
  checkinCount: number;
  managerRoles: ManagerRoleItem[];
  managerIconUrl: string;
  level: {
    name: string;
    iconUrl: string;
  } | null;
};

type UserInfoResponse = {
  ok?: boolean;
  status?: UserInfoStatus;
  blockReason?: string;
  userInfo?: UserInfoData;
  error?: string;
};

export default function UserInfo() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const [status, setStatus] = useState<UserInfoStatus | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfoData | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogErrorMessage, setDialogErrorMessage] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedNickname = useMemo(() => normalizeText(nickname), [nickname]);

  const canSubmit = useMemo(() => {
    if (!userInfo) {
      return false;
    }

    if (!trimmedNickname) {
      return false;
    }

    return trimmedNickname !== normalizeText(userInfo.nickname);
  }, [trimmedNickname, userInfo]);

  async function loadUserInfo() {
    try {
      setErrorMessage('');

      const response = await fetch(`/api/users/${siteName}/[userId]`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as UserInfoResponse;

      if (!response.ok || !result.status) {
        throw new Error(result.error ?? '사용자 정보를 불러오지 못했습니다.');
      }

      setStatus(result.status);
      setUserInfo(result.userInfo ?? null);
      setBlockReason(result.blockReason ?? '');
      setNickname(result.userInfo?.nickname ?? '');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '사용자 정보를 불러오지 못했습니다.');
      } else {
        setErrorMessage('사용자 정보를 불러오지 못했습니다.');
      }
    }
  }

  useEffect(() => {
    if (!siteName) {
      return;
    }

    void loadUserInfo();
  }, [siteName]);

  function handleOpenDialog() {
    if (!userInfo) {
      return;
    }

    setNickname(userInfo.nickname);
    setDialogErrorMessage('');
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    if (isSubmitting) {
      return;
    }

    setNickname(userInfo?.nickname ?? '');
    setDialogErrorMessage('');
    setIsDialogOpen(false);
  }

  function handleNicknameChange(event: ChangeEvent<HTMLInputElement>) {
    setNickname(event.currentTarget.value);
    setDialogErrorMessage('');
  }

  async function handleSubmit() {
    if (!canSubmit || isSubmitting) {
      return;
    }

    try {
      setDialogErrorMessage('');
      setIsSubmitting(true);

      const response = await fetch('/api/site/community/user', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          nickname: trimmedNickname,
        }),
      });

      const result = (await response.json()) as UserInfoResponse;

      if (!response.ok || !result.userInfo) {
        throw new Error(result.error ?? '프로필 수정에 실패했습니다.');
      }

      setStatus(result.status ?? 'active');
      setUserInfo(result.userInfo);
      setNickname(result.userInfo.nickname);
      setIsDialogOpen(false);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '프로필 수정에 실패했습니다.');
      } else {
        setDialogErrorMessage('프로필 수정에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (errorMessage) {
    return (
      <div className={`${styles['user-status']} paper`}>
        <p>{errorMessage}</p>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  if (status === 'guest') {
    return (
      <div className={`${styles['user-status']} paper`}>
        <Anchor href={`/${siteName}/join`} className="button">
          로그인하러 가기
        </Anchor>
      </div>
    );
  }

  if (status === 'not_joined') {
    return (
      <div className={`${styles['user-status']} paper`}>
        <Anchor href={`/${siteName}/join`} className="button">
          가입하러 가기
        </Anchor>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className={`${styles['user-status']} paper`}>
        <p>가입 승인 대기중입니다.</p>
        <p>조금만 기다려주세요! 😭</p>
      </div>
    );
  }

  if (status === 'blocked') {
    return (
      <div className={`${styles['user-status']} paper`}>
        <p>차단된 멤버입니다.</p>
        <p>사유: {blockReason}</p>
      </div>
    );
  }

  if (!userInfo) {
    return null;
  }

  const isManager = userInfo.managerRoles.length > 0;
  const roleIconUrl = isManager ? userInfo.managerIconUrl : userInfo.level?.iconUrl || '';
  const roleLabel = isManager ? userInfo.managerRoles.map((role) => role.label).join(', ') : userInfo.level?.name || '';

  return (
    <div className={`${styles['user-info']} paper`}>
      <div className={styles.avatar}>
        <Avatar src={userInfo.avatarUrl || '/broken-image.jpg'} alt={userInfo.nickname || userInfo.activityName} />
      </div>

      <div className={styles.info}>
        <div className={styles['info-detail']}>
          <em>{userInfo.activityName}</em>
          <cite>{userInfo.nickname}</cite>
          <span>{formatDate(userInfo.joinedAt)} 가입</span>
        </div>
        <div className={styles.button}>
          <button type="button" onClick={handleOpenDialog}>
            프로필 설정
          </button>
        </div>
      </div>

      <Dialog
        open={isDialogOpen}
        onClose={handleCloseDialog}
        fullWidth
        maxWidth="xs"
        className={`vh-dialog vh-alert-dialog ${styles['info-dialog']}`}
      >
        <DialogTitle>프로필 설정</DialogTitle>
        <DialogContent className={styles['info-content']}>
          {dialogErrorMessage ? <p>{dialogErrorMessage}</p> : null}
          <div className={styles['form-group']}>
            <cite>
              {userInfo.activityName} <span>(데브허브 활동명)</span>
            </cite>
            <div className={styles['form-control']}>
              <input type="text" value={nickname} onChange={handleNicknameChange} placeholder="별명을 입력하세요" />
            </div>
            <div className={styles.misc}>
              <div className={styles.role}>
                <span>{roleLabel}</span>
                {roleIconUrl ? <img src={roleIconUrl} alt={roleLabel} /> : null}
              </div>
              <time>({formatDate(userInfo.joinedAt)} 가입)</time>
            </div>
          </div>
          <dl className={styles['info-user-detail']}>
            <div>
              <dt>방문</dt>
              <dd>{userInfo.checkinCount.toLocaleString()} 회</dd>
            </div>

            <div>
              <dt>작성글</dt>
              <dd>{userInfo.postCount.toLocaleString()} 개</dd>
            </div>

            <div>
              <dt>작성댓글</dt>
              <dd>{userInfo.commentCount.toLocaleString()} 개</dd>
            </div>
          </dl>
        </DialogContent>
        <DialogActions>
          <button type="button" onClick={handleCloseDialog} disabled={isSubmitting} className="cancel-button">
            취소
          </button>
          <button type="button" onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            확인
          </button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
