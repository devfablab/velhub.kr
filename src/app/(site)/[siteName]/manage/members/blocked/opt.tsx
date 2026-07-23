'use client';

import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
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
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ko } from 'date-fns/locale';
import { formatDate, normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import MemberRestrictionMessageDialog from '@/components/service/community/MemberRestrictionMessageDialog';
import {
  memberRestrictionMessageStatusLabels,
  type MemberRestrictionMessageStatus,
} from '@/lib/users/memberRestrictionMessages';
import PlanBillingMemberPopup from '../planBillingMemberPopup';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

type TextFieldChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type BlockedUserRow = {
  userId: string;
  nickname: string;
  blockReason: string;
  blockedAt: string | null;
  blockTerm: string | null;
  blockedBy: string;
  messageStatus: MemberRestrictionMessageStatus | null;
};

type PlanBillingSubscriberResponse = {
  ok?: boolean;
  userId?: string | null;
  error?: string;
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
  const [isPlanBillingMemberPopupOpen, setIsPlanBillingMemberPopupOpen] = useState(false);

  const [actionType, setActionType] = useState<ActionType>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionTerm, setActionTerm] = useState<Date | null>(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [dialogErrorMessage, setDialogErrorMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [messageUser, setMessageUser] = useState<BlockedUserRow | null>(null);

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
  }, [loadUsers]);

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

  async function handleOpenActionDialog(nextActionType: Exclude<ActionType, null>) {
    if (selectedUserIds.length === 0) {
      setErrorMessage('멤버를 선택해주세요.');
      return;
    }

    if (nextActionType === 'kick' || nextActionType === 'ban') {
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
          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}

          <div className={`paper ${styles.paper}`}>
            <Stack direction="row" gap={1.5} alignItems="center">
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

          <Stack gap={1.5}>
            <Stack direction="row" justifyContent="space-between" sx={{ p: 2, pb: 0 }}>
              <button
                type="button"
                className="button small action"
                onClick={() => handleOpenActionDialog('unblock')}
                disabled={isActionSubmitting}
              >
                활동 정지 해제
              </button>
              <Stack direction="row" gap={1.5} justifyContent="space-between">
                <button
                  type="button"
                  className="button small warning"
                  onClick={() => handleOpenActionDialog('kick')}
                  disabled={isActionSubmitting}
                >
                  강제 탈퇴
                </button>
                <button
                  type="button"
                  className="button small warning"
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
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>별명</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>활동정지 사유</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>활동정지 처리일</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>활동정지 해제일</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>활동정지 처리자</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>소명 상태</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>소명 메시지</TableCell>
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
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{user.nickname}</TableCell>
                      <TableCell sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                        {user.blockReason}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {user.blockedAt ? formatDate(user.blockedAt) : ''}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {user.blockTerm ? formatDate(user.blockTerm) : ''}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{user.blockedBy}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {user.messageStatus ? memberRestrictionMessageStatusLabels[user.messageStatus] : '도착 전'}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {user.messageStatus ? (
                          <button
                            type="button"
                            className="button small action"
                            onClick={() => setMessageUser(user)}
                          >
                            메시지 보기
                          </button>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}

                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
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
              <Stack gap={2} sx={{ pt: 1 }}>
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
              <button className="close-button" onClick={handleCloseActionDialog}>
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <Stack gap={2} sx={{ pt: 1 }}>
                  {actionType === 'unblock' ? <Typography variant="subtitle2">활동정지를 해제합니다</Typography> : null}
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
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="button medium close`"
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

          <MemberRestrictionMessageDialog
            open={Boolean(messageUser)}
            endpoint={
              messageUser
                ? `/api/manage/members/restriction-messages/${messageUser.userId}/block?siteName=${encodeURIComponent(siteName)}`
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

          <Snackbar
            open={Boolean(snackbarMessage)}
            autoHideDuration={2700}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            onClose={() => setSnackbarMessage('')}
            message={snackbarMessage}
          />
        </div>
      </div>
    </Container>
  );
}
