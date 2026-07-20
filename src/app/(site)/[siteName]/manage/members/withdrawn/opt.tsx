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
import PlanBillingMemberPopup from '../planBillingMemberPopup';
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
  kickTerm: string | null;
};

type PlanBillingSubscriberResponse = {
  ok?: boolean;
  userId?: string | null;
  error?: string;
};

type WithdrawnUsersResponse = {
  ok?: boolean;
  users?: WithdrawnUserRow[];
  error?: string;
};

type ActionType = 'unkick' | 'ban' | 'unban' | null;
type SelectionType = 'banned' | 'kicked' | 'bannable' | null;

function getUserSelectionType(user: WithdrawnUserRow): Exclude<SelectionType, null> {
  if (user.type === '가입불가') {
    return 'banned';
  }

  if (user.type === '강제탈퇴') {
    return 'kicked';
  }

  return 'bannable';
}

export default function Opt() {
  const params = useParams();

  const siteName = normalizeText(params.siteName).toLowerCase();

  const [users, setUsers] = useState<WithdrawnUserRow[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const [nicknameKeyword, setNicknameKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const [isPlanBillingMemberPopupOpen, setIsPlanBillingMemberPopupOpen] = useState(false);

  const [actionType, setActionType] = useState<ActionType>(null);
  const [actionReason, setActionReason] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [dialogErrorMessage, setDialogErrorMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  async function getPlanBillingSubscriberUserId() {
    const response = await fetch(`/api/manage/members/plan-billing-subscriber?siteName=${siteName}`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = (await response.json()) as PlanBillingSubscriberResponse;

    if (!response.ok) {
      throw new Error(result.error ?? '요금제 결제 멤버를 확인하지 못했습니다.');
    }

    return normalizeText(result.userId) || null;
  }

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

  const selectionType = useMemo<SelectionType>(() => {
    const firstSelectedUserId = selectedUserIds[0];

    if (!firstSelectedUserId) {
      return null;
    }

    const firstSelectedUser = users.find((user) => user.userId === firstSelectedUserId);

    return firstSelectedUser ? getUserSelectionType(firstSelectedUser) : null;
  }, [selectedUserIds, users]);

  const selectableFilteredUsers = useMemo(() => {
    if (!selectionType) {
      return filteredUsers;
    }

    return filteredUsers.filter((user) => getUserSelectionType(user) === selectionType);
  }, [filteredUsers, selectionType]);

  const allFilteredSelected =
    selectableFilteredUsers.length > 0 &&
    selectableFilteredUsers.every((user) => selectedUserIds.includes(user.userId));

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
        const firstFilteredUser = filteredUsers[0];

        if (!firstFilteredUser) {
          return previousUserIds;
        }

        const nextSelectionType = selectionType ?? getUserSelectionType(firstFilteredUser);

        filteredUsers.forEach((user) => {
          if (getUserSelectionType(user) === nextSelectionType) {
            nextUserIds.add(user.userId);
          }
        });

        return [...nextUserIds];
      });

      return;
    }

    const filteredUserIdSet = new Set(selectableFilteredUsers.map((user) => user.userId));

    setSelectedUserIds((previousUserIds) => previousUserIds.filter((userId) => !filteredUserIdSet.has(userId)));
  }

  function handleToggleUser(userId: string, checked: boolean) {
    if (checked) {
      setSelectedUserIds((previousUserIds) => [...new Set([...previousUserIds, userId])]);

      return;
    }

    setSelectedUserIds((previousUserIds) => previousUserIds.filter((targetUserId) => targetUserId !== userId));
  }

  async function handleOpenActionDialog(nextActionType: Exclude<ActionType, null>) {
    if (selectedUserIds.length === 0) {
      setErrorMessage('멤버를 선택해주세요.');
      return;
    }

    if (nextActionType === 'ban') {
      try {
        const planBillingSubscriberUserId = await getPlanBillingSubscriberUserId();

        if (planBillingSubscriberUserId && selectedUserIds.includes(planBillingSubscriberUserId)) {
          setIsPlanBillingMemberPopupOpen(true);
          return;
        }
      } catch (unknownError) {
        setErrorMessage(
          unknownError instanceof Error
            ? unknownError.message || '요금제 결제 멤버를 확인하지 못했습니다.'
            : '요금제 결제 멤버를 확인하지 못했습니다.',
        );
        return;
      }
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
      return '가입불가';
    }

    if (actionType === 'unban') {
      return '가입불가 해제';
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

    if (actionType === 'unban') {
      return '가입불가 해제 사유';
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

        if (actionType === 'unban') {
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

      const completedActionTitle = getActionTitle();

      await loadUsers();

      setSelectedUserIds([]);
      setActionType(null);
      setActionReason('');
      setSnackbarMessage(`${completedActionTitle} 처리되었습니다.`);
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
      <Container pageTitle="멤버 관리" pageBack={`/${siteName}/manage`} menu="members">
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
    <Container pageTitle="멤버 관리" pageBack={`/${siteName}/manage`} menu="members">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <div className={`paper ${styles.paper}`}>
            <Stack direction="row" gap={1.5} alignItems="center">
              <TextField
                placeholder="별명 검색"
                value={nicknameKeyword}
                onChange={handleNicknameKeywordChange}
                fullWidth
                size="small"
              />

              <button type="button" className="button medium action" onClick={handleSearch}>
                <SearchRoundedIcon />
              </button>
            </Stack>

            {errorMessage ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{errorMessage}</span>
              </p>
            ) : null}
          </div>

          {selectedUserIds.length > 0 ? (
            <Stack direction="row" justifyContent="space-between" gap={1.5} sx={{ p: 2, pb: 0 }}>
              {selectionType === 'banned' ? (
                <button
                  type="button"
                  className="button small action"
                  onClick={() => handleOpenActionDialog('unban')}
                  disabled={isActionSubmitting}
                >
                  가입불가 해제
                </button>
              ) : null}

              {selectionType === 'kicked' ? (
                <>
                  <button
                    type="button"
                    className="button small action"
                    onClick={() => handleOpenActionDialog('unkick')}
                    disabled={isActionSubmitting}
                  >
                    강제탈퇴 해제
                  </button>

                  <button
                    type="button"
                    className="button small warning"
                    onClick={() => handleOpenActionDialog('ban')}
                    disabled={isActionSubmitting}
                  >
                    가입불가
                  </button>
                </>
              ) : null}

              {selectionType === 'bannable' ? (
                <button
                  type="button"
                  className="button small warning"
                  onClick={() => handleOpenActionDialog('ban')}
                  disabled={isActionSubmitting}
                >
                  가입불가
                </button>
              ) : null}
            </Stack>
          ) : null}

          <div className={`paper ${styles.paper}`}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={allFilteredSelected}
                      onChange={handleToggleAll}
                      disabled={isActionSubmitting || filteredUsers.length === 0}
                    />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>이메일 (별명)</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>탈퇴 사유</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>탈퇴 처리일 (처리자)</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>탈퇴 종류</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {filteredUsers.map((user) => {
                  return (
                    <TableRow key={user.userId}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedUserIds.includes(user.userId)}
                          onChange={(event) => handleToggleUser(user.userId, event.currentTarget.checked)}
                          disabled={
                            isActionSubmitting ||
                            (selectionType !== null && getUserSelectionType(user) !== selectionType)
                          }
                        />
                      </TableCell>
                      <TableCell>{user.displayName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'pre-line' }}>{user.reason}</TableCell>
                      <TableCell>
                        {user.processedAt ? `${formatDate(user.processedAt)} (${user.processedBy})` : ''}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {user.type === '강제탈퇴' && user.kickTerm
                          ? `${user.type} (${formatDate(user.kickTerm)} 재가입 가능)`
                          : user.type}
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <p className="alert info">
                        <InfoOutlineRoundedIcon />
                        <span>검색 결과가 없습니다.</span>
                      </p>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={Boolean(actionType)}
          onClose={handleCloseActionDialog}
          className="VhiDrawer-bottom"
        >
          <h2>{getActionTitle()}</h2>
          <button
            type="button"
            className="close-button"
            onClick={handleCloseActionDialog}
            disabled={isActionSubmitting}
          >
            <CloseRoundedIcon />
          </button>
          <Stack direction="column" gap={2} sx={{ p: 1 }}>
            <p className="alert warning">
              <WarningAmberRoundedIcon />
              <span>선택한 멤버에게 해당 처리를 진행합니다.</span>
            </p>

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

            <Stack direction="column" gap={1.5}>
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
        <Dialog
          open={Boolean(actionType)}
          onClose={handleCloseActionDialog}
          fullWidth
          maxWidth="sm"
          className="VhiDialog"
        >
          <DialogTitle>{getActionTitle()}</DialogTitle>

          <button
            type="button"
            className="close-button"
            onClick={handleCloseActionDialog}
            disabled={isActionSubmitting}
          >
            <CloseRoundedIcon />
          </button>

          <DialogContent>
            <Stack direction="column" gap={2}>
              <p className="alert warning">
                <WarningAmberRoundedIcon />
                <span>선택한 멤버에게 해당 처리를 진행합니다.</span>
              </p>

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
            </Stack>
          </DialogContent>

          <DialogActions>
            <button
              type="button"
              className="button medium close"
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
          </DialogActions>
        </Dialog>
      )}

      <PlanBillingMemberPopup
        open={isPlanBillingMemberPopupOpen}
        onClose={() => setIsPlanBillingMemberPopupOpen(false)}
      />

      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={2700}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        onClose={() => setSnackbarMessage('')}
        message={snackbarMessage}
      />
    </Container>
  );
}
