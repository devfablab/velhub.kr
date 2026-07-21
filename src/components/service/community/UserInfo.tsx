'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import { DialogActions, DialogContent, DialogTitle, Drawer, Typography, useMediaQuery, useTheme } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { formatDate, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import styles from '@/app/aside.module.sass';

type UserInfoStatus =
  | 'guest'
  | 'not_joined'
  | 'invite_only'
  | 'pending_join'
  | 'pending_invite'
  | 'blocked'
  | 'kicked'
  | 'banned'
  | 'active';

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
  inviteHref?: string;
  blockReason?: string;
  isPlanBillingSubscriber?: boolean;
  userInfo?: UserInfoData;
  error?: string;
};

export default function UserInfo() {
  const params = useParams();
  const router = useRouter();
  const siteName = normalizeText(params.siteName);

  const [status, setStatus] = useState<UserInfoStatus | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfoData | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [inviteHref, setInviteHref] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogErrorMessage, setDialogErrorMessage] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [isWithdrawSubmitting, setIsWithdrawSubmitting] = useState(false);
  const [withdrawErrorMessage, setWithdrawErrorMessage] = useState('');
  const [isPlanBillingSubscriber, setIsPlanBillingSubscriber] = useState(false);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

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

      const response = await fetch(`/api/users/${siteName}/me`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as UserInfoResponse;

      if (!response.ok || !result.status) {
        throw new Error(result.error ?? '사용자 정보를 불러오지 못했습니다.');
      }

      setStatus(result.status);
      setInviteHref(result.inviteHref ?? '');
      setUserInfo(result.status === 'active' ? (result.userInfo ?? null) : null);
      setBlockReason(result.blockReason ?? '');
      setIsPlanBillingSubscriber(result.isPlanBillingSubscriber === true);
      setNickname(result.status === 'active' ? (result.userInfo?.nickname ?? '') : '');
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

  function handleOpenWithdrawDialog() {
    setWithdrawErrorMessage('');
    setIsWithdrawDialogOpen(true);
  }

  function handleCloseWithdrawDialog() {
    if (isWithdrawSubmitting) {
      return;
    }

    setWithdrawErrorMessage('');
    setIsWithdrawDialogOpen(false);
  }

  async function handleWithdraw() {
    if (isWithdrawSubmitting) {
      return;
    }

    try {
      setWithdrawErrorMessage('');
      setIsWithdrawSubmitting(true);

      const response = await fetch(`/api/users/${siteName}/me`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const result = (await response.json()) as UserInfoResponse;

      if (!response.ok) {
        if (result.error === '이용자님은 요금제를 월결제하시는 분입니다. 탈퇴하실 수 없어요.') {
          setIsPlanBillingSubscriber(true);
        }

        throw new Error(result.error ?? '커뮤니티 탈퇴에 실패했습니다.');
      }

      setIsWithdrawDialogOpen(false);
      setUserInfo(null);
      setStatus('not_joined');
      router.replace(`/${siteName}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setWithdrawErrorMessage(unknownError.message || '커뮤니티 탈퇴에 실패했습니다.');
      } else {
        setWithdrawErrorMessage('커뮤니티 탈퇴에 실패했습니다.');
      }
    } finally {
      setIsWithdrawSubmitting(false);
    }
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

      const response = await fetch(`/api/users/${siteName}/me`, {
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

  if (status === 'pending_join') {
    return (
      <div className={`${styles['user-status']} paper`}>
        <p>가입 승인 대기중입니다.</p>
        <p>조금만 기다려주세요! </p>
      </div>
    );
  }

  if (status === 'pending_invite') {
    return (
      <div className={`${styles['user-status']} paper`}>
        <p>받은 초대장이 있습니다</p>
        <Anchor href={inviteHref} className="button">
          초대에 응하기
        </Anchor>
      </div>
    );
  }

  if (status === 'invite_only') {
    return (
      <div className={`${styles['user-status']} paper`}>
        <p>초대 전용 커뮤니티입니다.</p>
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
  const isWithdrawBlocked = isManager || isPlanBillingSubscriber;
  const withdrawBlockedMessage = isPlanBillingSubscriber
    ? '이용자님은 요금제를 월결제하시는 분입니다. 탈퇴하실 수 없어요.'
    : '매니저는 탈퇴하실 수 없습니다.';
  const withdrawBlockedButtonText = isPlanBillingSubscriber ? '확인' : '닫기';
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
          {userInfo.activityName !== userInfo.nickname ? <cite>{userInfo.nickname}</cite> : null}
          <span>{formatDate(userInfo.joinedAt)} 가입</span>
        </div>
        <div className={styles.button}>
          <button type="button" onClick={handleOpenDialog}>
            프로필 설정
          </button>
          <button type="button" onClick={handleOpenWithdrawDialog}>
            탈퇴하기
          </button>
        </div>
      </div>

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isDialogOpen}
          onClose={handleCloseDialog}
          className={`VhiDrawer-bottom VhiDrawer-bottom-service ${styles['draw-dialog']}`}
        >
          <h2>프로필 설정</h2>
          <button className="close-button" onClick={handleCloseDialog} aria-label="프로필 설정 닫기">
            <CloseRoundedIcon />
          </button>
          <div className={`VhiDrawer-bottom-content ${styles['info-content']}`}>
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
          </div>
          <div className={styles['drawer-dialog-actions']}>
            <button type="button" onClick={handleCloseDialog} disabled={isSubmitting} className="button medium cancel">
              취소
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="button medium submit"
            >
              확인
            </button>
          </div>
        </Drawer>
      ) : (
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
      )}
      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isWithdrawDialogOpen}
          onClose={handleCloseWithdrawDialog}
          className={`VhiDrawer-bottom VhiDrawer-bottom-service ${styles['draw-dialog']}`}
        >
          <h2>{isWithdrawBlocked ? '탈퇴 불가' : '커뮤니티 탈퇴'}</h2>
          <button
            type="button"
            className="close-button"
            onClick={handleCloseWithdrawDialog}
            disabled={isWithdrawSubmitting}
            aria-label={isWithdrawBlocked ? '탈퇴 불가 안내 닫기' : '커뮤니티 탈퇴 닫기'}
          >
            <CloseRoundedIcon />
          </button>
          <div className={`VhiDrawer-bottom-content ${styles['info-content']}`}>
            {isWithdrawBlocked ? (
              <Typography variant="subtitle2">{withdrawBlockedMessage}</Typography>
            ) : (
              <>
                <Typography variant="subtitle2">정말로 커뮤니티를 탈퇴하시겠어요?</Typography>
                {withdrawErrorMessage ? (
                  <p className="alert error">
                    <span>{withdrawErrorMessage}</span>
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className={styles['drawer-dialog-actions']}>
            {isWithdrawBlocked ? (
              <button type="button" className="button medium submit" onClick={handleCloseWithdrawDialog}>
                {withdrawBlockedButtonText}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="button medium cancel"
                  onClick={handleCloseWithdrawDialog}
                  disabled={isWithdrawSubmitting}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="button medium warning"
                  onClick={handleWithdraw}
                  disabled={isWithdrawSubmitting}
                >
                  탈퇴하기
                </button>
              </>
            )}
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={isWithdrawDialogOpen}
          onClose={handleCloseWithdrawDialog}
          fullWidth
          maxWidth="xs"
          className={`vh-dialog vh-alert-dialog ${styles['info-dialog']}`}
        >
          <DialogTitle>{isWithdrawBlocked ? '탈퇴 불가' : '커뮤니티 탈퇴'}</DialogTitle>

          <DialogContent className={styles['info-content']}>
            {isWithdrawBlocked ? (
              <Typography variant="subtitle2">{withdrawBlockedMessage}</Typography>
            ) : (
              <>
                <Typography variant="subtitle2">정말로 커뮤니티를 탈퇴하시겠어요?</Typography>

                {withdrawErrorMessage ? (
                  <p className="alert error">
                    <span>{withdrawErrorMessage}</span>
                  </p>
                ) : null}
              </>
            )}
          </DialogContent>

          <DialogActions>
            {isWithdrawBlocked ? (
              <button type="button" className="cancel-button" onClick={handleCloseWithdrawDialog}>
                {withdrawBlockedButtonText}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={handleCloseWithdrawDialog}
                  disabled={isWithdrawSubmitting}
                >
                  취소
                </button>

                <button
                  type="button"
                  className="warning-button"
                  onClick={handleWithdraw}
                  disabled={isWithdrawSubmitting}
                >
                  탈퇴하기
                </button>
              </>
            )}
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}
