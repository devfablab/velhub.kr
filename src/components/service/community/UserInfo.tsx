'use client';

import { type ChangeEvent, type FormEvent, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { DialogActions, DialogContent, DialogTitle, Drawer, Typography, useMediaQuery, useTheme } from '@mui/material';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import { formatDate, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import FormErrorDialog from '@/components/FormErrorDialog';
import { useSiteInitialData } from '@/app/(site)/[siteName]/SiteInitialDataContext';
import styles from '@/app/aside.module.sass';

type UserInfoStatus =
  | 'guest'
  | 'not_joined'
  | 'not_recruiting'
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
  userInfo?: UserInfoData;
  error?: string;
};

type ErrorPopup = {
  title: string | null;
  messages: string[];
};

export default function UserInfo() {
  const params = useParams();
  const router = useRouter();
  const siteName = normalizeText(params.siteName);
  const initialData = useSiteInitialData();
  const initialResponse = initialData?.communityUserInfo as UserInfoResponse | null;

  const [status, setStatus] = useState<UserInfoStatus | null>(initialResponse?.status ?? null);
  const [userInfo, setUserInfo] = useState<UserInfoData | null>(
    initialResponse?.status === 'active' ? (initialResponse.userInfo ?? null) : null,
  );
  const blockReason = initialResponse?.blockReason ?? '';
  const inviteHref = initialResponse?.inviteHref ?? '';
  const errorMessage = '';
  const [dialogErrorMessage, setDialogErrorMessage] = useState('');
  const [errorPopup, setErrorPopup] = useState<ErrorPopup | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [nickname, setNickname] = useState(
    initialResponse?.status === 'active' ? (initialResponse.userInfo?.nickname ?? '') : '',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [isWithdrawSubmitting, setIsWithdrawSubmitting] = useState(false);
  const [withdrawErrorMessage, setWithdrawErrorMessage] = useState('');

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const trimmedNickname = useMemo(() => normalizeText(nickname), [nickname]);

  const canSubmit = useMemo(() => {
    if (!userInfo) {
      return false;
    }

    if (Array.from(trimmedNickname).length < 2 || Array.from(trimmedNickname).length > 10) {
      return false;
    }

    return trimmedNickname !== normalizeText(userInfo.nickname);
  }, [trimmedNickname, userInfo]);

  function handleOpenDialog() {
    if (!userInfo) {
      return;
    }

    setNickname(userInfo.nickname);
    setDialogErrorMessage('');
    setErrorPopup(null);
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    if (isSubmitting) {
      return;
    }

    setNickname(userInfo?.nickname ?? '');
    setDialogErrorMessage('');
    setErrorPopup(null);
    setIsDialogOpen(false);
  }

  function handleOpenWithdrawDialog() {
    setWithdrawErrorMessage('');
    setErrorPopup(null);
    setIsWithdrawDialogOpen(true);
  }

  function handleCloseWithdrawDialog() {
    if (isWithdrawSubmitting) {
      return;
    }

    setWithdrawErrorMessage('');
    setErrorPopup(null);
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

      const result = (await response.json().catch(() => null)) as UserInfoResponse | null;

      if (!response.ok) {
        const message = result?.error ?? '커뮤니티 탈퇴에 실패했습니다.';
        setWithdrawErrorMessage(message);
        setErrorPopup({
          title: response.status < 500 ? '커뮤니티 탈퇴' : null,
          messages: [message],
        });
        return;
      }

      setIsWithdrawDialogOpen(false);
      setUserInfo(null);
      setStatus('not_joined');
      router.replace(`/${siteName}`);
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message || '커뮤니티 탈퇴에 실패했습니다.'
          : '커뮤니티 탈퇴에 실패했습니다.';
      setWithdrawErrorMessage(message);
      setErrorPopup({ title: null, messages: [message] });
    } finally {
      setIsWithdrawSubmitting(false);
    }
  }

  function handleNicknameChange(event: ChangeEvent<HTMLInputElement>) {
    setNickname(event.currentTarget.value);
    setDialogErrorMessage('');
  }

  function showNicknameError(message: string, title: string | null = '별명 확인') {
    setDialogErrorMessage(message);
    setErrorPopup({ title, messages: [message] });
  }

  function getNicknameValidationMessage() {
    if (!trimmedNickname) {
      return '별명을 입력해주세요.';
    }

    if (Array.from(trimmedNickname).length < 2 || Array.from(trimmedNickname).length > 10) {
      return '별명은 2자 이상 10자 이하로 입력해주세요.';
    }

    return '';
  }

  function handleNicknameInvalid(event: FormEvent<HTMLInputElement>) {
    event.preventDefault();
    showNicknameError(getNicknameValidationMessage() || '별명을 확인해주세요.');
  }

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (isSubmitting) {
      return;
    }

    const validationMessage = getNicknameValidationMessage();

    if (validationMessage) {
      showNicknameError(validationMessage);
      return;
    }

    if (!canSubmit) {
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

      const result = (await response.json().catch(() => null)) as UserInfoResponse | null;

      if (!response.ok || !result?.userInfo) {
        const message = result?.error ?? '프로필 수정에 실패했습니다.';
        showNicknameError(message, response.status < 500 ? '별명 확인' : null);
        return;
      }

      setStatus(result.status ?? 'active');
      setUserInfo(result.userInfo);
      setNickname(result.userInfo.nickname);
      setIsDialogOpen(false);
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message || '프로필 수정에 실패했습니다.'
          : '프로필 수정에 실패했습니다.';
      showNicknameError(message, null);
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

  if (status === 'not_recruiting') {
    return (
      <div className={`${styles['user-status']} paper`}>
        <p>현재 회원모집 기간이 아닙니다</p>
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
  const isWithdrawBlocked = isManager;
  const withdrawBlockedMessage = '매니저는 탈퇴하실 수 없습니다.';
  const withdrawBlockedButtonText = '닫기';
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
          <div>
            <button type="button" onClick={handleOpenDialog}>
              프로필 설정
            </button>
          </div>
          <div>
            <button type="button" onClick={handleOpenWithdrawDialog}>
              탈퇴하기
            </button>
          </div>
        </div>
      </div>

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isDialogOpen}
          onClose={handleCloseDialog}
          className={`VhiDrawer-bottom VhiDrawer-bottom-service ${styles['info-dialog']}`}
        >
          <h2>프로필 설정</h2>
          <button type="button" className="close-button" onClick={handleCloseDialog} aria-label="프로필 설정 닫기">
            <CloseRoundedIcon />
          </button>
          <div className={`VhiDrawer-bottom-content ${styles['info-content']}`}>
            <form id="community-profile-form-mobile" onSubmit={handleSubmit}>
              {dialogErrorMessage ? <p className="field-error">{dialogErrorMessage}</p> : null}
              <div className={styles['form-group']}>
                <cite>
                  {userInfo.activityName} <span>(데브허브 활동명)</span>
                </cite>
                <div className={styles['form-control']}>
                  <input
                    type="text"
                    name="nickname"
                    value={nickname}
                    onChange={handleNicknameChange}
                    onInvalid={handleNicknameInvalid}
                    placeholder="별명을 입력하세요"
                    minLength={2}
                    maxLength={10}
                    required
                    aria-invalid={Boolean(dialogErrorMessage)}
                  />
                </div>
                <p className={dialogErrorMessage ? 'field-error' : ''}>
                  {dialogErrorMessage || '별명은 2자 이상 10자 이하로 입력해주세요.'}
                </p>
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
            </form>
          </div>
          <div className="drawer-dialog-actions">
            <button type="button" onClick={handleCloseDialog} disabled={isSubmitting} className="button medium close">
              취소
            </button>
            <button
              type="submit"
              form="community-profile-form-mobile"
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
          <button type="button" className="close-button" onClick={handleCloseDialog} aria-label="프로필 설정 닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent className={styles['info-content']}>
            <form id="community-profile-form-desktop" onSubmit={handleSubmit}>
              {dialogErrorMessage ? <p className="field-error">{dialogErrorMessage}</p> : null}
              <div className={styles['form-group']}>
                <cite>
                  {userInfo.activityName} <span>(데브허브 활동명)</span>
                </cite>
                <div className={styles['form-control']}>
                  <input
                    type="text"
                    name="nickname"
                    value={nickname}
                    onChange={handleNicknameChange}
                    onInvalid={handleNicknameInvalid}
                    placeholder="별명을 입력하세요"
                    minLength={2}
                    maxLength={10}
                    required
                    aria-invalid={Boolean(dialogErrorMessage)}
                  />
                </div>
                <p className={dialogErrorMessage ? 'field-error' : ''}>
                  {dialogErrorMessage || '별명은 2자 이상 10자 이하로 입력해주세요.'}
                </p>
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
            </form>
          </DialogContent>
          <DialogActions>
            <button type="button" onClick={handleCloseDialog} disabled={isSubmitting} className="cancel-button">
              취소
            </button>
            <button type="submit" form="community-profile-form-desktop" disabled={!canSubmit || isSubmitting}>
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
                    <ErrorOutlineRoundedIcon />
                    <span>{withdrawErrorMessage}</span>
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className="drawer-dialog-actions">
            {isWithdrawBlocked ? (
              <button type="button" className="button medium submit" onClick={handleCloseWithdrawDialog}>
                {withdrawBlockedButtonText}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="button medium close"
                  onClick={handleCloseWithdrawDialog}
                  disabled={isWithdrawSubmitting}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="button medium danger"
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
          <button
            type="button"
            className="close-button"
            onClick={handleCloseWithdrawDialog}
            disabled={isWithdrawSubmitting}
            aria-label={isWithdrawBlocked ? '탈퇴 불가 안내 닫기' : '커뮤니티 탈퇴 닫기'}
          >
            <CloseRoundedIcon />
          </button>

          <DialogContent className={styles['info-content']}>
            {isWithdrawBlocked ? (
              <Typography variant="subtitle2">{withdrawBlockedMessage}</Typography>
            ) : (
              <>
                <Typography variant="subtitle2">정말로 커뮤니티를 탈퇴하시겠어요?</Typography>

                {withdrawErrorMessage ? (
                  <p className="alert error">
                    <ErrorOutlineRoundedIcon />
                    <span>{withdrawErrorMessage}</span>
                  </p>
                ) : null}
              </>
            )}
          </DialogContent>

          <DialogActions>
            {isWithdrawBlocked ? (
              <button type="button" onClick={handleCloseWithdrawDialog}>
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
                  className="danger-button"
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
      <FormErrorDialog
        open={Boolean(errorPopup)}
        title={errorPopup?.title ?? null}
        messages={errorPopup?.messages ?? []}
        onClose={() => setErrorPopup(null)}
      />
    </div>
  );
}
