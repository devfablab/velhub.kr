'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import { useParams } from 'next/navigation';
import {
  Button,
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
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { formatDate, normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

type TextFieldChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type BlockedUserRow = {
  userId: string;
  nickname: string;
  blockReason: string;
  blockedAt: string | null;
  blockedBy: string;
};

type BlockedUsersResponse = {
  ok?: boolean;
  users?: BlockedUserRow[];
  error?: string;
};

type ActionType = 'unblock' | 'kick' | 'ban' | null;

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const [users, setUsers] = useState<BlockedUserRow[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [nicknameKeyword, setNicknameKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  const [actionType, setActionType] = useState<ActionType>(null);
  const [actionReason, setActionReason] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [dialogErrorMessage, setDialogErrorMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  async function loadUsers() {
    const response = await fetch(`/api/manage/members/blocked?siteName=${siteName}`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = (await response.json()) as BlockedUsersResponse;

    if (!response.ok) {
      throw new Error(result.error ?? '활동정지 멤버 정보를 불러오지 못했습니다.');
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
          setErrorMessage(unknownError.message || '활동정지 멤버 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('활동정지 멤버 정보를 불러오지 못했습니다.');
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

    return users.filter((user) => normalizeText(user.nickname).toLowerCase().includes(keyword));
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

  function handleOpenActionDialog(nextActionType: Exclude<ActionType, null>) {
    if (selectedUserIds.length === 0) {
      setErrorMessage('멤버를 선택해주세요.');
      return;
    }

    setDialogErrorMessage('');
    setActionReason('');
    setActionType(nextActionType);
  }

  function handleCloseActionDialog() {
    if (isActionSubmitting) {
      return;
    }

    setDialogErrorMessage('');
    setActionReason('');
    setActionType(null);
  }

  function getActionTitle() {
    if (actionType === 'unblock') {
      return '활동 정지 해제';
    }

    if (actionType === 'kick') {
      return '강제 탈퇴';
    }

    if (actionType === 'ban') {
      return '가입 불가';
    }

    return '';
  }

  function getActionReasonLabel() {
    if (actionType === 'kick') {
      return '강제탈퇴 사유';
    }

    if (actionType === 'ban') {
      return '가입불가 사유';
    }

    return '';
  }

  async function handleSubmitAction() {
    if (!actionType) {
      return;
    }

    const trimmedReason = normalizeText(actionReason);

    if ((actionType === 'kick' || actionType === 'ban') && !trimmedReason) {
      setDialogErrorMessage(`${getActionReasonLabel()}를 입력해주세요.`);
      return;
    }

    try {
      setDialogErrorMessage('');
      setErrorMessage('');
      setIsActionSubmitting(true);

      for (const userId of selectedUserIds) {
        if (actionType === 'unblock') {
          const response = await fetch(`/api/users/${siteName}/${userId}/block`, {
            method: 'DELETE',
            credentials: 'include',
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error ?? '활동정지 해제에 실패했습니다.');
          }

          continue;
        }

        const response = await fetch(`/api/users/${siteName}/${userId}/${actionType}`, {
          method: 'PATCH',
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
          throw new Error(result.error ?? `${getActionTitle()} 처리에 실패했습니다.`);
        }
      }

      await loadUsers();
      setSelectedUserIds([]);
      setActionType(null);
      setActionReason('');
      setSnackbarMessage(`${getActionTitle()} 처리되었습니다.`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || `${getActionTitle()} 처리에 실패했습니다.`);
      } else {
        setDialogErrorMessage(`${getActionTitle()} 처리에 실패했습니다.`);
      }
    } finally {
      setIsActionSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Container pageTitle="활동 멤버 관리" pageBack={`/${siteName}/manage`} menu="members">
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
    <Container pageTitle="활동정지 멤버 관리" pageBack={`/${siteName}/manage`} menu="members">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}

          <div className={`paper ${styles.paper}`}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField
                label="별명 검색"
                value={nicknameKeyword}
                onChange={handleNicknameKeywordChange}
                fullWidth
                size="small"
              />
              <button type="button" className="button medium action" onClick={handleSearch}>
                검색
              </button>
            </Stack>
          </div>

          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between" sx={{ p: 2, pb: 0 }}>
              <button
                type="button"
                className="button medium action"
                onClick={() => handleOpenActionDialog('unblock')}
                disabled={isActionSubmitting}
              >
                활동 정지 해제
              </button>
              <Stack direction="row" spacing={1.5} justifyContent="space-between">
                <button
                  type="button"
                  className="button medium warning"
                  onClick={() => handleOpenActionDialog('kick')}
                  disabled={isActionSubmitting}
                >
                  강제 탈퇴
                </button>
                <button
                  type="button"
                  className="button medium warning"
                  onClick={() => handleOpenActionDialog('ban')}
                  disabled={isActionSubmitting}
                >
                  가입 불가
                </button>
              </Stack>
            </Stack>

            <div className={`paper ${styles.paper}`}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox checked={allFilteredSelected} onChange={handleToggleAll} />
                    </TableCell>
                    <TableCell>별명</TableCell>
                    <TableCell>활동정지 사유</TableCell>
                    <TableCell>활동정지 처리일</TableCell>
                    <TableCell>활동정지 처리자</TableCell>
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
                      <TableCell>{user.nickname}</TableCell>
                      <TableCell>{user.blockReason}</TableCell>
                      <TableCell>{user.blockedAt ? formatDate(user.blockedAt) : ''}</TableCell>
                      <TableCell>{user.blockedBy}</TableCell>
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
            <Drawer
              anchor="bottom"
              open={Boolean(actionType)}
              onClose={handleCloseActionDialog}
              className="VhiDrawer-bottom"
            >
              <h2>{getActionTitle()}</h2>
              <button className="close-button" onClick={handleCloseActionDialog}>
                <CloseRoundedIcon />
              </button>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <TextField
                  placeholder={getActionReasonLabel()}
                  value={actionReason}
                  onChange={(event) => setActionReason(event.currentTarget.value)}
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
                <Stack direction="column" spacing={1.5}>
                  <button
                    type="button"
                    className="button medium cancel"
                    onClick={handleCloseActionDialog}
                    disabled={isActionSubmitting}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="button medium submit"
                    onClick={handleSubmitAction}
                    disabled={isActionSubmitting}
                  >
                    확인
                  </button>
                </Stack>
              </Stack>
            </Drawer>
          ) : (
            <Dialog open={Boolean(actionType)} onClose={handleCloseActionDialog} fullWidth maxWidth="sm">
              <DialogTitle>{getActionTitle()}</DialogTitle>
              <DialogContent>
                <Stack spacing={2} sx={{ pt: 1 }}>
                  {actionType === 'kick' || actionType === 'ban' ? (
                    <TextField
                      label={getActionReasonLabel()}
                      value={actionReason}
                      onChange={(event) => setActionReason(event.currentTarget.value)}
                      fullWidth
                      multiline
                      minRows={4}
                      size="small"
                    />
                  ) : null}

                  {dialogErrorMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{dialogErrorMessage}</span>
                    </p>
                  ) : null}
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={handleCloseActionDialog}
                  disabled={isActionSubmitting}
                >
                  취소
                </Button>
                <Button type="button" variant="contained" onClick={handleSubmitAction} disabled={isActionSubmitting}>
                  확인
                </Button>
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
