'use client';

import { type JSX, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Avatar,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { formatDate, normalizeText } from '@/lib/utils';
import FormErrorDialog from '@/components/FormErrorDialog';
import PopupMessage from '@/components/PopupMessage';
import ScreenState from '@/components/service/ScreenState';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

type TextFieldChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type BannedUserRow = {
  userId: string;
  avatarUrl: string | null;
  nickname: string;
  userName: string;
  displayName: string;
  reason: string;
  processedAt: string | null;
  processedBy: string;
  type: string;
};

export type BannedUsersResponse = {
  ok?: boolean;
  users?: BannedUserRow[];
  error?: string;
};

type OptProps = { initialData: BannedUsersResponse | null; initialError: string };

export default function Opt({ initialData, initialError }: OptProps) {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const [users, setUsers] = useState<BannedUserRow[]>(Array.isArray(initialData?.users) ? initialData.users : []);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [nicknameKeyword, setNicknameKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [clearReason, setClearReason] = useState('');

  const [errorMessage, setErrorMessage] = useState(initialError);
  const [dialogErrorMessage, setDialogErrorMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(Boolean(initialError));

  function showPageError(message: string) {
    setErrorMessage(message);
    setIsErrorDialogOpen(true);
  }

  function showDialogError(message: string) {
    setDialogErrorMessage(message);
    setIsErrorDialogOpen(true);
  }

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  async function loadUsers() {
    const response = await fetch(`/api/manage/join/banned?siteName=${siteName}`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = (await response.json()) as BannedUsersResponse;

    if (!response.ok) {
      throw new Error(result.error ?? '가입불가 멤버 정보를 불러오지 못했습니다.');
    }

    setUsers(Array.isArray(result.users) ? result.users : []);
  }

  const filteredUsers = useMemo(() => {
    const keyword = normalizeText(appliedKeyword).toLowerCase();

    if (!keyword) {
      return users;
    }

    return users.filter((user) => {
      return (
        normalizeText(user.nickname).toLowerCase().includes(keyword) ||
        normalizeText(user.userName).toLowerCase().includes(keyword)
      );
    });
  }, [appliedKeyword, users]);
  const allFilteredSelected =
    filteredUsers.length > 0 && filteredUsers.every((user) => selectedUserIds.includes(user.userId));

  function handleNicknameKeywordChange(event: TextFieldChangeEvent) {
    setNicknameKeyword(event.currentTarget.value);
  }

  function handleSearch() {
    setAppliedKeyword(nicknameKeyword);
    setSelectedUserIds([]);
  }

  function handleToggleAll(event: InputChangeEvent) {
    if (event.currentTarget.checked) {
      setSelectedUserIds((previousUserIds) => {
        const nextUserIds = new Set(previousUserIds);

        filteredUsers.forEach((user) => {
          nextUserIds.add(user.userId);
        });

        return [...nextUserIds];
      });
      return;
    }

    const filteredUserIdSet = new Set(filteredUsers.map((user) => user.userId));
    setSelectedUserIds((previousUserIds) => previousUserIds.filter((userId) => !filteredUserIdSet.has(userId)));
  }

  function handleToggleUser(userId: string, checked: boolean) {
    if (checked) {
      setSelectedUserIds((previousUserIds) => [...new Set([...previousUserIds, userId])]);
      return;
    }

    setSelectedUserIds((previousUserIds) => previousUserIds.filter((targetUserId) => targetUserId !== userId));
  }

  function handleOpenDialog() {
    if (selectedUserIds.length === 0) {
      showPageError('멤버를 선택해주세요.');
      return;
    }

    setDialogErrorMessage('');
    setClearReason('');
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    if (isSubmitting) {
      return;
    }

    setDialogErrorMessage('');
    setClearReason('');
    setIsDialogOpen(false);
  }

  async function handleSubmit() {
    const trimmedReason = normalizeText(clearReason);

    if (!trimmedReason) {
      showDialogError('가입불가 해제 사유를 입력해주세요.');
      return;
    }

    try {
      setDialogErrorMessage('');
      setErrorMessage('');
      setIsSubmitting(true);

      for (const userId of selectedUserIds) {
        const response = await fetch(`/api/users/${siteName}/${userId}/ban`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            reason: trimmedReason,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? '가입불가 해제에 실패했습니다.');
        }
      }

      await loadUsers();
      setSelectedUserIds([]);
      setIsDialogOpen(false);
      setClearReason('');
      setSnackbarMessage('가입불가 해제 처리되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        showDialogError(unknownError.message || '가입불가 해제에 실패했습니다.');
      } else {
        showDialogError('가입불가 해제에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Container pageTitle="멤버 관리" pageBack={`/${siteName}/manage`} menu="join">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}
          <FormErrorDialog
            open={isErrorDialogOpen}
            title={errorMessage === '멤버를 선택해주세요.' ? '멤버 확인' : dialogErrorMessage ? '가입불가 해제' : null}
            messages={[dialogErrorMessage || errorMessage].filter(Boolean)}
            onClose={() => setIsErrorDialogOpen(false)}
          />

          <div className={`paper ${styles.paper}`}>
            <Stack direction="row" gap={1.5} alignItems="center">
              <TextField
                placeholder="이름 검색"
                value={nicknameKeyword}
                onChange={handleNicknameKeywordChange}
                fullWidth
                size="small"
              />
              <button type="button" className="button medium action" onClick={handleSearch} aria-label="이름으로 검색">
                <SearchRoundedIcon />
              </button>
            </Stack>
          </div>

          <Stack gap={1.5}>
            <Stack direction="row" gap={1.5} alignItems="center" justifyContent="space-between" sx={{ p: 2.5, pb: 0 }}>
              <Stack direction="row" gap={0.5} alignItems="center">
                <Checkbox checked={allFilteredSelected} onChange={handleToggleAll} size="small" />
                <Typography variant="subtitle2">{selectedUserIds.length}명이 선택됨</Typography>
              </Stack>
              <button
                type="button"
                className="button small action"
                onClick={handleOpenDialog}
                disabled={isSubmitting || selectedUserIds.length === 0}
              >
                가입불가 해제
              </button>
            </Stack>

            <div className={`paper ${styles.paper}`}>
              {filteredUsers.map((user) => (
                <div key={user.userId} className={styles['content-items']}>
                  <Stack gap={1} direction="row" alignItems="flex-start">
                    <Checkbox
                      checked={selectedUserIds.includes(user.userId)}
                      onChange={(event) => handleToggleUser(user.userId, event.currentTarget.checked)}
                      size="small"
                    />
                    <Avatar src={user.avatarUrl || '/broken-image.jpg'} alt={user.displayName} />
                    <Stack gap={1}>
                      <div className={styles.summary}>
                        <span>{user.displayName}</span>
                      </div>
                      <div className={styles.info}>
                        {user.processedAt ? (
                          <p>
                            {user.processedBy} 님이
                            {formatDate(user.processedAt)}에 처리함.
                          </p>
                        ) : null}
                        <p className={styles.reason}>{user.reason}</p>
                      </div>
                    </Stack>
                  </Stack>
                </div>
              ))}

              {filteredUsers.length === 0 ? <ScreenState>검색 결과가 없습니다.</ScreenState> : null}
            </div>
          </Stack>

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={isDialogOpen}
              onClose={handleCloseDialog}
              className="VhiDrawer-bottom VhiDrawer-bottom-service"
            >
              <h2>가입불가 해제</h2>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseDialog}
                aria-label="가입불가 해제 닫기"
                disabled={isSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <div className="VhiDrawer-bottom-content">
                <form
                  id="mobile-join-banned-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSubmit();
                  }}
                >
                  <Stack gap={2} sx={{ pt: 1 }}>
                    <TextField
                      placeholder="가입불가 해제 사유"
                      value={clearReason}
                      onChange={(event) => {
                        setClearReason(event.currentTarget.value);
                        setDialogErrorMessage('');
                      }}
                      error={Boolean(dialogErrorMessage)}
                      helperText={dialogErrorMessage}
                      fullWidth
                      multiline
                      minRows={4}
                      size="small"
                    />
                  </Stack>
                </form>
              </div>
              <div className="drawer-dialog-actions">
                <button
                  type="button"
                  className="button medium close"
                  onClick={handleCloseDialog}
                  disabled={isSubmitting}
                >
                  취소
                </button>
                <button
                  type="submit"
                  form="mobile-join-banned-form"
                  className="button medium submit"
                  disabled={isSubmitting}
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
              maxWidth="sm"
              className="vh-dialog vh-alert-dialog"
            >
              <DialogTitle>가입불가 해제</DialogTitle>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseDialog}
                aria-label="가입불가 해제 닫기"
                disabled={isSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <form
                  id="desktop-join-banned-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSubmit();
                  }}
                >
                  <Stack gap={2} sx={{ pt: 1 }}>
                    <TextField
                      placeholder="가입불가 해제 사유"
                      value={clearReason}
                      onChange={(event) => {
                        setClearReason(event.currentTarget.value);
                        setDialogErrorMessage('');
                      }}
                      error={Boolean(dialogErrorMessage)}
                      helperText={dialogErrorMessage}
                      fullWidth
                      multiline
                      minRows={4}
                      size="small"
                    />
                  </Stack>
                </form>
              </DialogContent>
              <DialogActions>
                <button type="button" className="cancel-button" onClick={handleCloseDialog} disabled={isSubmitting}>
                  취소
                </button>
                <button type="submit" form="desktop-join-banned-form" disabled={isSubmitting}>
                  확인
                </button>
              </DialogActions>
            </Dialog>
          )}

          <PopupMessage
            open={Boolean(snackbarMessage)}
            message={snackbarMessage}
            onClose={() => setSnackbarMessage('')}
          />
        </div>
      </div>
    </Container>
  );
}
