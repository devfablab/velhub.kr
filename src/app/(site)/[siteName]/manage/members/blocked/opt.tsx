'use client';

import { type JSX, useCallback, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Avatar,
  Checkbox,
  Chip,
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
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ko } from 'date-fns/locale';
import {
  type MemberRestrictionMessageStatus,
  getStaffRestrictionMessageStatusLabel,
} from '@/lib/users/memberRestrictionMessages';
import { formatDate, normalizeText } from '@/lib/utils';
import FormErrorDialog from '@/components/FormErrorDialog';
import PopupMessage from '@/components/PopupMessage';
import MemberRestrictionMessageDialog from '@/components/service/community/MemberRestrictionMessageDialog';
import ScreenState from '@/components/service/ScreenState';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

type TextFieldChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type BlockedUserRow = {
  userId: string;
  avatarUrl: string | null;
  nickname: string;
  userName: string;
  blockReason: string;
  blockedAt: string | null;
  blockTerm: string | null;
  blockedBy: string;
  messageStatus: MemberRestrictionMessageStatus | null;
};

export type BlockedUsersResponse = {
  ok?: boolean;
  users?: BlockedUserRow[];
  error?: string;
};

type ActionType = 'unblock' | 'kick' | 'ban' | null;

type OptProps = { initialData: BlockedUsersResponse | null; initialError: string };

function hasBlockTermEnded(blockTerm: string | null) {
  if (!blockTerm) return false;

  const termDate = new Date(blockTerm);
  if (Number.isNaN(termDate.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  termDate.setHours(0, 0, 0, 0);

  return termDate <= today;
}

function getBlockedUserStatusChip(user: Pick<BlockedUserRow, 'blockTerm' | 'messageStatus'>) {
  if (hasBlockTermEnded(user.blockTerm)) {
    return { label: '활동정지 해제됨', status: 'default' } as const;
  }

  if (!user.messageStatus) {
    return { label: '소명 미제출', status: 'danger' } as const;
  }

  return {
    label: getStaffRestrictionMessageStatusLabel(user.messageStatus),
    status: user.messageStatus === 'staff_replied' ? 'success' : 'warning',
  } as const;
}

export default function Opt({ initialData, initialError }: OptProps) {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const [users, setUsers] = useState<BlockedUserRow[]>(Array.isArray(initialData?.users) ? initialData.users : []);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [nicknameKeyword, setNicknameKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');

  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  const [actionType, setActionType] = useState<ActionType>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionTerm, setActionTerm] = useState<Date | null>(null);

  const [errorMessage, setErrorMessage] = useState(initialError);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(Boolean(initialError));
  const [errorDialogMessage, setErrorDialogMessage] = useState(initialError);
  const [errorDialogTitle, setErrorDialogTitle] = useState<string | null>(initialError ? '멤버 관리' : null);
  const [dialogErrorMessage, setDialogErrorMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [messageUser, setMessageUser] = useState<BlockedUserRow | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const isMinimal = useMediaQuery(theme.breakpoints.down(572));

  function showError(message: string, title: string | null = '멤버 관리') {
    setErrorMessage(message);
    setErrorDialogMessage(message);
    setErrorDialogTitle(title);
    setIsErrorDialogOpen(true);
  }

  function showDialogError(message: string, title: string | null) {
    setDialogErrorMessage(message);
    setErrorDialogMessage(message);
    setErrorDialogTitle(title);
    setIsErrorDialogOpen(true);
  }

  const loadUsers = useCallback(async () => {
    const response = await fetch(`/api/manage/members/blocked?siteName=${siteName}`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = (await response.json()) as BlockedUsersResponse;

    if (!response.ok) {
      throw new Error(result.error ?? '활동정지 멤버 정보를 불러오지 못했습니다.');
    }

    setUsers(Array.isArray(result.users) ? result.users : []);
  }, [siteName]);

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

  async function handleOpenActionDialog(nextActionType: Exclude<ActionType, null>) {
    if (selectedUserIds.length === 0) {
      showError('멤버를 선택해주세요.');
      return;
    }

    setDialogErrorMessage('');
    setActionReason('');
    setActionTerm(null);
    setActionType(nextActionType);
  }

  function handleCloseActionDialog() {
    if (isActionSubmitting) {
      return;
    }

    setDialogErrorMessage('');
    setActionReason('');
    setActionTerm(null);
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

  function getActionTermLabel() {
    if (actionType === 'kick') {
      return '재가입 가능 날짜';
    }

    if (actionType === 'ban') {
      return '가입불가 해제 날짜';
    }

    return '';
  }

  async function handleSubmitAction() {
    if (!actionType) {
      return;
    }

    const trimmedReason = normalizeText(actionReason);

    if ((actionType === 'kick' || actionType === 'ban') && !trimmedReason) {
      showDialogError(`${getActionReasonLabel()}를 입력해주세요.`, getActionTitle());
      return;
    }

    if (actionTerm && actionTerm.getTime() <= Date.now()) {
      showDialogError(`${getActionTermLabel()}는 오늘 이후로 선택해주세요.`, getActionTitle());
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
            kickTerm: actionType === 'kick' && actionTerm ? actionTerm.toISOString() : null,
            banTerm: actionType === 'ban' && actionTerm ? actionTerm.toISOString() : null,
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
      setActionTerm(null);
      setSnackbarMessage(`${getActionTitle()} 처리되었습니다.`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        showDialogError(
          unknownError.message || `${getActionTitle()} 처리에 실패했습니다.`,
          unknownError instanceof TypeError ? null : getActionTitle(),
        );
      } else {
        showDialogError(`${getActionTitle()} 처리에 실패했습니다.`, null);
      }
    } finally {
      setIsActionSubmitting(false);
    }
  }

  return (
    <Container pageTitle="멤버 관리" pageBack={`/${siteName}/manage`} menu="members">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}

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
            <Stack
              direction={isMobile ? 'column' : 'row'}
              gap={isMobile ? undefined : 1.5}
              alignItems={isMobile ? undefined : 'center'}
              justifyContent={isMobile ? undefined : 'space-between'}
              sx={{ p: isMobile ? 1.5 : 2.5, pb: 0 }}
            >
              <Stack direction="row" gap={0.5} alignItems="center">
                <Checkbox checked={allFilteredSelected} onChange={handleToggleAll} size="small" />
                <Typography variant="subtitle2">{selectedUserIds.length}명이 선택됨</Typography>
              </Stack>
              <Stack direction="row" gap={1.5} alignItems="center">
                <button
                  type="button"
                  className="button small warning"
                  onClick={() => handleOpenActionDialog('kick')}
                  disabled={isActionSubmitting || selectedUserIds.length === 0}
                >
                  강제 탈퇴
                </button>
                <button
                  type="button"
                  className="button small warning"
                  onClick={() => handleOpenActionDialog('ban')}
                  disabled={isActionSubmitting || selectedUserIds.length === 0}
                >
                  가입 불가
                </button>
                <button
                  type="button"
                  className="button small action"
                  onClick={() => handleOpenActionDialog('unblock')}
                  disabled={isActionSubmitting || selectedUserIds.length === 0}
                >
                  활동 정지 해제
                </button>
              </Stack>
            </Stack>

            <div className={`paper ${styles.paper}`}>
              {filteredUsers.map((user) => {
                const statusChip = getBlockedUserStatusChip(user);
                const blockTermEnded = hasBlockTermEnded(user.blockTerm);
                return (
                  <div key={user.userId} className={styles['content-items']}>
                    <Stack
                      direction={isMinimal ? 'column' : 'row'}
                      justifyContent={isMinimal ? undefined : 'space-between'}
                      gap={isMinimal ? 2 : undefined}
                    >
                      <Stack direction="row" alignItems="flex-start" gap={1}>
                        <Checkbox
                          checked={selectedUserIds.includes(user.userId)}
                          onChange={(event) => handleToggleUser(user.userId, event.currentTarget.checked)}
                          size="small"
                        />
                        <Avatar src={user.avatarUrl || '/broken-image.jpg'} alt={user.nickname} />
                        <Stack gap={1}>
                          <div className={styles.summary}>
                            <span>{user.nickname}</span>
                          </div>
                          <div className={styles.status}>
                            <div className={styles.info}>
                              <p>
                                {user.blockedBy} 님이 {user.blockedAt ? formatDate(user.blockedAt) : ''}에 활동정지
                                처리함.
                              </p>
                              <p className={styles.reason}>{user.blockReason}</p>
                            </div>
                            <div className={styles.info}>
                              <p>
                                {user.blockTerm
                                  ? `${formatDate(user.blockTerm)}에 활동정지 ${blockTermEnded ? '해제됨.' : '해제 예정.'}`
                                  : '활동정지 해제가 결정되지 않았습니다.'}
                              </p>
                              {user.messageStatus ? (
                                <button type="button" className="link-normal" onClick={() => setMessageUser(user)}>
                                  소명 내용 보기
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </Stack>
                      </Stack>
                      <Stack justifyContent="flex-end" direction="row">
                        <div>
                          <Chip label={statusChip.label} size="small" className={`chip ${statusChip.status}`} />
                        </div>
                      </Stack>
                    </Stack>
                  </div>
                );
              })}

              {filteredUsers.length === 0 ? <ScreenState>검색 결과가 없습니다.</ScreenState> : null}
            </div>
          </Stack>

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={Boolean(actionType)}
              onClose={handleCloseActionDialog}
              className="VhiDrawer-bottom VhiDrawer-bottom-service"
            >
              <h2>{getActionTitle()}</h2>
              <button type="button" className="close-button" onClick={handleCloseActionDialog} aria-label="닫기">
                <CloseRoundedIcon />
              </button>
              <div className="VhiDrawer-bottom-content">
                <form
                  id="mobile-blocked-members-action-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSubmitAction();
                  }}
                >
                  <Stack gap={2} sx={{ pt: 1 }}>
                    {actionType === 'kick' || actionType === 'ban' ? (
                      <Stack gap={1}>
                        <Typography variant="subtitle2">{getActionReasonLabel()}</Typography>
                        <TextField
                          value={actionReason}
                          onChange={(event) => setActionReason(event.currentTarget.value)}
                          fullWidth
                          multiline
                          minRows={4}
                          size="small"
                          error={Boolean(dialogErrorMessage)}
                          helperText={dialogErrorMessage}
                        />
                      </Stack>
                    ) : null}
                    {actionType === 'kick' || actionType === 'ban' ? (
                      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                        <Stack gap={1}>
                          <Typography variant="subtitle2">{getActionTermLabel()}</Typography>
                          <DatePicker
                            value={actionTerm}
                            onChange={setActionTerm}
                            format="yyyy년 MM월 dd일"
                            minDate={new Date()}
                            disabled={isActionSubmitting}
                            slotProps={{
                              textField: {
                                fullWidth: true,
                                size: 'small',
                              },
                              popper: {
                                sx: {
                                  zIndex: 9999,
                                },
                              },
                            }}
                          />
                        </Stack>
                      </LocalizationProvider>
                    ) : null}

                    {dialogErrorMessage ? (
                      <p className="alert error">
                        <ErrorOutlineRoundedIcon />
                        <span>{dialogErrorMessage}</span>
                      </p>
                    ) : null}
                  </Stack>
                </form>
              </div>
              <div className="drawer-dialog-actions">
                <button
                  type="button"
                  className="button medium close"
                  onClick={handleCloseActionDialog}
                  disabled={isActionSubmitting}
                >
                  취소
                </button>
                <button
                  type="submit"
                  form="mobile-blocked-members-action-form"
                  className="button medium submit"
                  disabled={isActionSubmitting}
                >
                  확인
                </button>
              </div>
            </Drawer>
          ) : (
            <Dialog
              open={Boolean(actionType)}
              onClose={handleCloseActionDialog}
              fullWidth
              maxWidth="sm"
              className="vh-dialog vh-alert-dialog"
            >
              <DialogTitle>{getActionTitle()}</DialogTitle>
              <button type="button" className="close-button" onClick={handleCloseActionDialog} aria-label="닫기">
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <form
                  id="desktop-blocked-members-action-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSubmitAction();
                  }}
                >
                  <Stack gap={2} sx={{ pt: 1 }}>
                    {actionType === 'unblock' ? (
                      <Typography variant="subtitle2">활동정지를 해제합니다</Typography>
                    ) : null}
                    {actionType === 'kick' || actionType === 'ban' ? (
                      <>
                        <Typography variant="subtitle2">{getActionReasonLabel()}</Typography>
                        <TextField
                          value={actionReason}
                          onChange={(event) => setActionReason(event.currentTarget.value)}
                          fullWidth
                          multiline
                          minRows={4}
                          size="small"
                          error={Boolean(dialogErrorMessage)}
                          helperText={dialogErrorMessage}
                        />
                      </>
                    ) : null}
                    {actionType === 'kick' || actionType === 'ban' ? (
                      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                        <Typography variant="subtitle2">{getActionTermLabel()}</Typography>
                        <DatePicker
                          value={actionTerm}
                          onChange={setActionTerm}
                          format="yyyy.MM.dd"
                          minDate={new Date()}
                          disabled={isActionSubmitting}
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              size: 'small',
                            },
                          }}
                        />
                      </LocalizationProvider>
                    ) : null}

                    {dialogErrorMessage ? (
                      <p className="alert error">
                        <ErrorOutlineRoundedIcon />
                        <span>{dialogErrorMessage}</span>
                      </p>
                    ) : null}
                  </Stack>
                </form>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={handleCloseActionDialog}
                  disabled={isActionSubmitting}
                >
                  취소
                </button>
                <button type="submit" form="desktop-blocked-members-action-form" disabled={isActionSubmitting}>
                  확인
                </button>
              </DialogActions>
            </Dialog>
          )}

          <MemberRestrictionMessageDialog
            open={Boolean(messageUser)}
            endpoint={
              messageUser
                ? `/api/manage/members/restriction-messages/${messageUser.userId}/block?siteName=${siteName}`
                : ''
            }
            ownSenderType="staff"
            inputPlaceholder="답변하세요"
            successMessage="답변을 보냈습니다."
            postBody={{ siteName }}
            onClose={() => setMessageUser(null)}
            onSent={() => {
              if (!messageUser) {
                return;
              }

              setUsers((current) =>
                current.map((user) =>
                  user.userId === messageUser.userId ? { ...user, messageStatus: 'staff_replied' } : user,
                ),
              );
            }}
          />

          <PopupMessage
            open={Boolean(snackbarMessage)}
            message={snackbarMessage}
            onClose={() => setSnackbarMessage('')}
          />
          <FormErrorDialog
            open={isErrorDialogOpen}
            title={errorDialogTitle}
            messages={errorDialogMessage ? [errorDialogMessage] : []}
            onClose={() => setIsErrorDialogOpen(false)}
          />
        </div>
      </div>
    </Container>
  );
}
