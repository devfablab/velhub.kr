'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import { useParams } from 'next/navigation';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { formatDate, normalizeText } from '@/lib/utils';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

type TextFieldChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type WithdrawnUserRow = {
  userId: string;
  displayName: string;
  reason: string;
  processedAt: string | null;
  processedBy: string;
  type: string;
};

type WithdrawnUsersResponse = {
  ok?: boolean;
  users?: WithdrawnUserRow[];
  error?: string;
};

type ActionType = 'unkick' | 'ban' | null;

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const [users, setUsers] = useState<WithdrawnUserRow[]>([]);
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

  async function loadUsers() {
    const response = await fetch(`/api/manage/members/withdrawn?siteName=${siteName}`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = (await response.json()) as WithdrawnUsersResponse;

    if (!response.ok) {
      throw new Error(result.error ?? '탈퇴 멤버 정보를 불러오지 못했습니다.');
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
          setErrorMessage(unknownError.message || '탈퇴 멤버 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('탈퇴 멤버 정보를 불러오지 못했습니다.');
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
    if (actionType === 'unkick') {
      return '강제탈퇴 해제';
    }

    if (actionType === 'ban') {
      return '가입 불가';
    }

    return '';
  }

  function getActionReasonLabel() {
    if (actionType === 'unkick') {
      return '강제탈퇴 해제 사유';
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

    if (!trimmedReason) {
      setDialogErrorMessage(`${getActionReasonLabel()}를 입력해주세요.`);
      return;
    }

    try {
      setDialogErrorMessage('');
      setErrorMessage('');
      setIsActionSubmitting(true);

      for (const userId of selectedUserIds) {
        if (actionType === 'unkick') {
          const response = await fetch(`/api/users/${siteName}/${userId}/kick`, {
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
            throw new Error(result.error ?? '강제탈퇴 해제에 실패했습니다.');
          }

          continue;
        }

        const response = await fetch(`/api/users/${siteName}/${userId}/ban`, {
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
          throw new Error(result.error ?? '가입불가 처리에 실패했습니다.');
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
    return null;
  }

  return (
    <Container pageTitle="탈퇴 멤버 관리" pageBack={`/${siteName}/manage`} menu="members">
      <div className="container">
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField
                label="별명 검색"
                value={nicknameKeyword}
                onChange={handleNicknameKeywordChange}
                fullWidth
                size="small"
              />
              <Button type="button" variant="contained" onClick={handleSearch}>
                검색
              </Button>
            </Stack>
          </Paper>

          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Button
                type="button"
                variant="outlined"
                onClick={() => handleOpenActionDialog('unkick')}
                disabled={isActionSubmitting}
              >
                강제탈퇴 해제
              </Button>
              <Button
                type="button"
                variant="outlined"
                color="error"
                onClick={() => handleOpenActionDialog('ban')}
                disabled={isActionSubmitting}
              >
                가입 불가
              </Button>
            </Stack>

            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox checked={allFilteredSelected} onChange={handleToggleAll} />
                    </TableCell>
                    <TableCell>이메일 (별명)</TableCell>
                    <TableCell>탈퇴 사유</TableCell>
                    <TableCell>탈퇴 처리일 (처리자)</TableCell>
                    <TableCell>탈퇴 종류</TableCell>
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
                      <TableCell>{user.displayName}</TableCell>
                      <TableCell>{user.reason}</TableCell>
                      <TableCell>
                        {user.processedAt ? `${formatDate(user.processedAt)} (${user.processedBy})` : ''}
                      </TableCell>
                      <TableCell>{user.type}</TableCell>
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
            </TableContainer>
          </Stack>

          <Dialog open={Boolean(actionType)} onClose={handleCloseActionDialog} fullWidth maxWidth="sm">
            <DialogTitle>{getActionTitle()}</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <TextField
                  label={getActionReasonLabel()}
                  value={actionReason}
                  onChange={(event) => setActionReason(event.currentTarget.value)}
                  fullWidth
                  multiline
                  minRows={4}
                  size="small"
                />

                {dialogErrorMessage ? (
                  <Alert severity="error" variant="filled">
                    {dialogErrorMessage}
                  </Alert>
                ) : null}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button type="button" variant="outlined" onClick={handleCloseActionDialog} disabled={isActionSubmitting}>
                취소
              </Button>
              <Button type="button" variant="contained" onClick={handleSubmitAction} disabled={isActionSubmitting}>
                확인
              </Button>
            </DialogActions>
          </Dialog>

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
