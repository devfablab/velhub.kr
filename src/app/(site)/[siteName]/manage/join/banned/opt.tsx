'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import { useParams } from 'next/navigation';
import {
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { formatDate, normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

type TextFieldChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type BannedUserRow = {
  userId: string;
  displayName: string;
  reason: string;
  processedAt: string | null;
  processedBy: string;
  type: string;
};

type BannedUsersResponse = {
  ok?: boolean;
  users?: BannedUserRow[];
  error?: string;
};

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const [users, setUsers] = useState<BannedUserRow[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [nicknameKeyword, setNicknameKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [clearReason, setClearReason] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [dialogErrorMessage, setDialogErrorMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

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

  useEffect(() => {
    async function init() {
      try {
        setErrorMessage('');
        await loadUsers();
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '가입불가 멤버 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('가입불가 멤버 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void init();
  }, [siteName]);

  const filteredUsers = useMemo(() => {
    const keyword = normalizeText(appliedKeyword).toLowerCase();

    if (!keyword) {
      return users;
    }

    return users.filter((user) => normalizeText(user.displayName).toLowerCase().includes(keyword));
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
      setErrorMessage('멤버를 선택해주세요.');
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
      setDialogErrorMessage('가입불가 해제 사유를 입력해주세요.');
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
        setDialogErrorMessage(unknownError.message || '가입불가 해제에 실패했습니다.');
      } else {
        setDialogErrorMessage('가입불가 해제에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Container pageTitle="멤버 관리" pageBack={`/${siteName}/manage`} menu="join">
        <div className={`container ${styles.container}`}>
          <div className={`${styles.content} content`}>
            <div className={`paper ${styles.paper}`}>
              <div className="loading-container">
                <LoadingIndicator />
              </div>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container pageTitle="멤버 관리" pageBack={`/${siteName}/manage`} menu="join">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}

          <div className={`paper ${styles.paper}`}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField
                placeholder="별명 검색"
                value={nicknameKeyword}
                onChange={handleNicknameKeywordChange}
                fullWidth
                size="small"
              />
              <button type="button" className="button medium action" onClick={handleSearch} aria-label="별명으로 검색">
                <SearchRoundedIcon />
              </button>
            </Stack>
          </div>

          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 2, pb: 0 }}>
              <button type="button" className="button small action" onClick={handleOpenDialog} disabled={isSubmitting}>
                가입불가 해제
              </button>
            </Stack>

            <div className={`paper paper-p0 ${styles.paper}`}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox checked={allFilteredSelected} onChange={handleToggleAll} />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>이메일 (별명)</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>가입불가 사유</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>가입불가 처리일 (처리자)</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>처리 종류</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedUserIds.includes(user.userId)}
                          onChange={(event) => handleToggleUser(user.userId, event.currentTarget.checked)}
                        />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{user.displayName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{user.reason}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {user.processedAt ? `${formatDate(user.processedAt)} (${user.processedBy})` : ''}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{user.type}</TableCell>
                    </TableRow>
                  ))}

                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        검색 결과가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </Stack>

          {isMobile ? (
            <Drawer anchor="bottom" open={isDialogOpen} onClose={handleCloseDialog} className="VhiDrawer-bottom">
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

              <Stack gap={3}>
                <Stack spacing={2} sx={{ pt: 1 }}>
                  <TextField
                    placeholder="가입불가 해제 사유"
                    value={clearReason}
                    onChange={(event) => setClearReason(event.currentTarget.value)}
                    fullWidth
                    multiline
                    minRows={4}
                    size="small"
                  />

                  {dialogErrorMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{dialogErrorMessage}</span>
                    </p>
                  ) : null}
                </Stack>

                <Stack direction="column" spacing={1.5}>
                  <button
                    type="button"
                    className="button medium cancel"
                    onClick={handleCloseDialog}
                    disabled={isSubmitting}
                  >
                    취소
                  </button>
                  <button type="button" className="button medium submit" onClick={handleSubmit} disabled={isSubmitting}>
                    확인
                  </button>
                </Stack>
              </Stack>
            </Drawer>
          ) : (
            <Dialog open={isDialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm" className="VhiDialog">
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
                <Stack spacing={2} sx={{ pt: 1 }}>
                  <TextField
                    placeholder="가입불가 해제 사유"
                    value={clearReason}
                    onChange={(event) => setClearReason(event.currentTarget.value)}
                    fullWidth
                    multiline
                    minRows={4}
                    size="small"
                  />

                  {dialogErrorMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{dialogErrorMessage}</span>
                    </p>
                  ) : null}
                </Stack>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="button medium close"
                  onClick={handleCloseDialog}
                  disabled={isSubmitting}
                >
                  취소
                </button>
                <button type="button" className="button medium submit" onClick={handleSubmit} disabled={isSubmitting}>
                  확인
                </button>
              </DialogActions>
            </Dialog>
          )}

          <Snackbar
            open={Boolean(snackbarMessage)}
            autoHideDuration={2500}
            onClose={() => setSnackbarMessage('')}
            message={snackbarMessage}
          />
        </div>
      </div>
    </Container>
  );
}
