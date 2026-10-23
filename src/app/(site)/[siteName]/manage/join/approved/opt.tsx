'use client';

import { type JSX, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Avatar,
  Box,
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
import { formatDateTimeDetail } from '@/lib/utils';
import { normalizeText } from '@/lib/utils';
import FormErrorDialog from '@/components/FormErrorDialog';
import PopupMessage from '@/components/PopupMessage';
import ScreenState from '@/components/service/ScreenState';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type TextFieldChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;

type AnsweredQuestionRow = {
  questionId: string | null;
  question: string;
  type: string;
  answer: string;
  answers: string[];
  imageUrl: string;
  imageUrls: string[];
};

type JoinApplicantRow = {
  userId: string;
  avatarUrl: string | null;
  email: string;
  userName: string;
  nickname: string;
  createdAt: string;
  rejectedAt: string | null;
  rejectedBy: string;
  isReApproval: boolean;
  answeredQuestions: AnsweredQuestionRow[];
};

export type JoinApprovedResponse = {
  ok?: boolean;
  users?: JoinApplicantRow[];
  error?: string;
};

type ActionType = 'approve' | 'reject' | null;

function formatDateKorean(value: string | null | undefined) {
  return formatDateTimeDetail(value);
}

type OptProps = { initialData: JoinApprovedResponse | null; initialError: string };

export default function Opt({ initialData, initialError }: OptProps) {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const [users, setUsers] = useState<JoinApplicantRow[]>(Array.isArray(initialData?.users) ? initialData.users : []);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<JoinApplicantRow | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState(initialError);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(Boolean(initialError));
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [confirmActionType, setConfirmActionType] = useState<ActionType>(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const isMinimal = useMediaQuery(theme.breakpoints.down(572));

  function showError(message: string) {
    setErrorMessage(message);
    setIsErrorDialogOpen(true);
  }

  async function loadUsers() {
    const response = await fetch(`/api/manage/join/approved?siteName=${siteName}`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = (await response.json()) as JoinApprovedResponse;

    if (!response.ok) {
      throw new Error(result.error ?? '가입 신청 정보를 불러오지 못했습니다.');
    }

    setUsers(Array.isArray(result.users) ? result.users : []);
  }

  const filteredUsers = useMemo(() => {
    const keyword = normalizeText(appliedKeyword).toLowerCase();

    if (!keyword) {
      return users;
    }

    return users.filter((user) => {
      const userName = normalizeText(user.userName).toLowerCase();
      const nickname = normalizeText(user.nickname).toLowerCase();

      return userName.includes(keyword) || nickname.includes(keyword);
    });
  }, [appliedKeyword, users]);

  const allFilteredSelected =
    filteredUsers.length > 0 && filteredUsers.every((user) => selectedUserIds.includes(user.userId));

  function handleSearchKeywordChange(event: TextFieldChangeEvent) {
    setSearchKeyword(event.currentTarget.value);
  }

  function handleSearch() {
    setAppliedKeyword(searchKeyword);
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

  function handleOpenConfirmAction(nextActionType: Exclude<ActionType, null>) {
    if (selectedUserIds.length === 0) {
      showError(nextActionType === 'approve' ? '가입 승인할 멤버를 선택해주세요.' : '가입 거절할 멤버를 선택해주세요.');
      return;
    }

    setErrorMessage('');
    setConfirmActionType(nextActionType);
  }

  function handleCloseConfirmAction() {
    if (isSubmitting) {
      return;
    }

    setConfirmActionType(null);
  }

  function getConfirmActionTitle() {
    if (confirmActionType === 'approve') {
      return '가입 승인';
    }

    if (confirmActionType === 'reject') {
      return '가입 거절';
    }

    return '';
  }

  function getConfirmActionMessage() {
    if (confirmActionType === 'approve') {
      return '정말로 가입을 승인하시겠어요?';
    }

    if (confirmActionType === 'reject') {
      return '정말로 가입을 거절하시겠어요?';
    }

    return '';
  }

  function getConfirmActionButtonLabel() {
    if (confirmActionType === 'approve') {
      return '승인';
    }

    if (confirmActionType === 'reject') {
      return '거절';
    }

    return '';
  }

  async function handleSubmitAction(action: 'approve' | 'reject') {
    if (selectedUserIds.length === 0) {
      showError(action === 'approve' ? '가입 승인할 멤버를 선택해주세요.' : '가입 거절할 멤버를 선택해주세요.');
      return;
    }

    try {
      setErrorMessage('');
      setIsSubmitting(true);

      const response = await fetch('/api/manage/join/approved', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          action,
          userIds: selectedUserIds,
        }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(
          result.error ?? (action === 'approve' ? '가입 승인 처리에 실패했습니다.' : '가입 거절 처리에 실패했습니다.'),
        );
      }

      await loadUsers();
      setSelectedUserIds([]);
      setConfirmActionType(null);
      setSnackbarMessage(action === 'approve' ? '가입 승인되었습니다.' : '가입 거절되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        showError(
          unknownError.message ||
            (action === 'approve' ? '가입 승인 처리에 실패했습니다.' : '가입 거절 처리에 실패했습니다.'),
        );
      } else {
        showError(action === 'approve' ? '가입 승인 처리에 실패했습니다.' : '가입 거절 처리에 실패했습니다.');
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
            title={errorMessage.includes('선택') ? '가입 신청 확인' : null}
            messages={errorMessage ? [errorMessage] : []}
            onClose={() => setIsErrorDialogOpen(false)}
          />

          <div className={`paper ${styles.paper}`}>
            <Stack direction="row" gap={1.5} alignItems="center">
              <TextField
                placeholder="이름 검색"
                value={searchKeyword}
                onChange={handleSearchKeywordChange}
                fullWidth
                size="small"
              />
              <button
                type="button"
                className="button medium action"
                onClick={handleSearch}
                aria-label="이름으로 검색"
              >
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
              <Stack direction="row" gap={1.5}>
                <button
                  type="button"
                  className="button small action"
                  onClick={() => handleOpenConfirmAction('approve')}
                  disabled={isSubmitting || selectedUserIds.length === 0}
                >
                  가입 승인
                </button>
                <button
                  type="button"
                  className="button small warning"
                  onClick={() => handleOpenConfirmAction('reject')}
                  disabled={isSubmitting || selectedUserIds.length === 0}
                >
                  가입 거절
                </button>
              </Stack>
            </Stack>

            <div className={`paper ${styles.paper}`}>
              {filteredUsers.map((user) => (
                <div key={user.userId} className={styles['content-items']}>
                  <Stack direction="row" justifyContent="space-between">
                    <Stack gap={1} direction="row">
                      <Checkbox
                        checked={selectedUserIds.includes(user.userId)}
                        onChange={(event) => handleToggleUser(user.userId, event.currentTarget.checked)}
                        size="small"
                        className={styles.checkbox}
                      />
                      <Avatar src={user.avatarUrl || '/broken-image.jpg'} alt={user.nickname || user.userName} />
                      <div className={styles.summary}>
                        <span>
                          {user.isReApproval ? '(재신청) ' : ''}
                          {user.nickname || user.userName}
                        </span>
                        <p>{formatDateKorean(user.createdAt)} 가입신청</p>
                      </div>
                    </Stack>
                    {user.answeredQuestions.length > 0 ? (
                      <button className="button small normal" type="button" onClick={() => setSelectedUser(user)}>
                        가입 답변
                      </button>
                    ) : null}
                  </Stack>
                </div>
              ))}
              {filteredUsers.length === 0 ? <ScreenState>검색 결과가 없습니다.</ScreenState> : null}
            </div>
          </Stack>

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={Boolean(selectedUser)}
              onClose={() => setSelectedUser(null)}
              className="VhiDrawer-bottom"
            >
              <h2>가입 신청 답변</h2>
              <button
                type="button"
                className="close-button"
                onClick={() => setSelectedUser(null)}
                aria-label="가입 신청 답변 닫기"
                disabled={isSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <div className="VhiDrawer-bottom-content">
                <div className={`paper ${styles['paper-sub']}`}>
                  {selectedUser?.answeredQuestions && selectedUser.answeredQuestions.length > 0 ? (
                    selectedUser.answeredQuestions.map((item, index) => (
                      <div key={`${item.questionId ?? 'question'}-${index}`} className={styles['question-item']}>
                        <Stack gap={1}>
                          <Typography variant="subtitle2">{item.question || `질문 ${index + 1}`}</Typography>

                          {item.type === 'objective' ? (
                            <Typography variant="body2">{item.answers.join(', ')}</Typography>
                          ) : item.imageUrls.length > 0 || item.imageUrl ? (
                            <Stack gap={1}>
                              {item.imageUrls.length > 0 ? (
                                item.imageUrls.map((imageUrl, imageIndex) => (
                                  <Box
                                    key={`${imageUrl}-${imageIndex}`}
                                    component="img"
                                    src={imageUrl}
                                    alt={`답변 이미지 ${imageIndex + 1}`}
                                    sx={{
                                      width: '100%',
                                      maxHeight: 320,
                                      objectFit: 'contain',
                                      display: 'block',
                                      borderRadius: 1,
                                    }}
                                  />
                                ))
                              ) : item.imageUrl ? (
                                <Box
                                  component="img"
                                  src={item.imageUrl}
                                  alt="답변 이미지"
                                  sx={{
                                    width: '100%',
                                    maxHeight: 320,
                                    objectFit: 'contain',
                                    display: 'block',
                                    borderRadius: 1,
                                  }}
                                />
                              ) : null}
                            </Stack>
                          ) : (
                            <Typography variant="body2">{item.answer}</Typography>
                          )}
                        </Stack>
                      </div>
                    ))
                  ) : (
                    <Typography variant="body2">가입 신청 답변이 없습니다.</Typography>
                  )}
                </div>
              </div>
              <div className="drawer-dialog-actions">
                <button type="button" className="button medium close" onClick={() => setSelectedUser(null)}>
                  닫기
                </button>
              </div>
            </Drawer>
          ) : (
            <Dialog
              open={Boolean(selectedUser)}
              onClose={() => setSelectedUser(null)}
              fullWidth
              maxWidth="sm"
              className="VhiDialog"
            >
              <DialogTitle>가입 신청 답변</DialogTitle>
              <button
                type="button"
                className="close-button"
                onClick={() => setSelectedUser(null)}
                aria-label="가입 신청 답변 닫기"
                disabled={isSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <div className={`paper ${styles['paper-sub']}`}>
                  {selectedUser?.answeredQuestions && selectedUser.answeredQuestions.length > 0 ? (
                    selectedUser.answeredQuestions.map((item, index) => (
                      <div key={`${item.questionId ?? 'question'}-${index}`} className={styles['question-item']}>
                        <Stack gap={1}>
                          <Typography variant="subtitle2">{item.question || `질문 ${index + 1}`}</Typography>

                          {item.type === 'objective' ? (
                            <Typography variant="body2">{item.answers.join(', ')}</Typography>
                          ) : item.imageUrls.length > 0 || item.imageUrl ? (
                            <Stack gap={1}>
                              {item.imageUrls.length > 0 ? (
                                item.imageUrls.map((imageUrl, imageIndex) => (
                                  <Box
                                    key={`${imageUrl}-${imageIndex}`}
                                    component="img"
                                    src={imageUrl}
                                    alt={`답변 이미지 ${imageIndex + 1}`}
                                    sx={{
                                      width: '100%',
                                      maxHeight: 320,
                                      objectFit: 'contain',
                                      display: 'block',
                                      borderRadius: 1,
                                    }}
                                  />
                                ))
                              ) : item.imageUrl ? (
                                <Box
                                  component="img"
                                  src={item.imageUrl}
                                  alt="답변 이미지"
                                  sx={{
                                    width: '100%',
                                    maxHeight: 320,
                                    objectFit: 'contain',
                                    display: 'block',
                                    borderRadius: 1,
                                  }}
                                />
                              ) : null}
                            </Stack>
                          ) : (
                            <Typography variant="body2">{item.answer}</Typography>
                          )}
                        </Stack>
                      </div>
                    ))
                  ) : (
                    <Typography variant="body2">가입 신청 답변이 없습니다.</Typography>
                  )}
                </div>
              </DialogContent>
              <DialogActions>
                <button type="button" className="button medium submit" onClick={() => setSelectedUser(null)}>
                  닫기
                </button>
              </DialogActions>
            </Dialog>
          )}
          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={Boolean(confirmActionType)}
              onClose={handleCloseConfirmAction}
              className="VhiDrawer-bottom VhiDrawer-bottom-service"
            >
              <h2>{getConfirmActionTitle()}</h2>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseConfirmAction}
                aria-label={`${getConfirmActionTitle()} 창 닫기`}
                disabled={isSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <div className="VhiDrawer-bottom-content">
                <form
                  id="mobile-join-approved-action-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (confirmActionType) {
                      void handleSubmitAction(confirmActionType);
                    }
                  }}
                >
                  <Typography variant="body2">{getConfirmActionMessage()}</Typography>
                </form>
              </div>
              <div className="drawer-dialog-actions">
                <button
                  type="button"
                  className="button medium close"
                  onClick={handleCloseConfirmAction}
                  disabled={isSubmitting}
                >
                  취소
                </button>
                <button
                  type="submit"
                  form="mobile-join-approved-action-form"
                  className={confirmActionType === 'approve' ? 'button medium submit' : 'button medium danger'}
                  disabled={isSubmitting}
                >
                  {getConfirmActionButtonLabel()}
                </button>
              </div>
            </Drawer>
          ) : (
            <Dialog
              open={Boolean(confirmActionType)}
              onClose={handleCloseConfirmAction}
              fullWidth
              maxWidth="xs"
              className="vh-dialog vh-alert-dialog"
            >
              <DialogTitle>{getConfirmActionTitle()}</DialogTitle>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseConfirmAction}
                aria-label={`${getConfirmActionTitle()} 창 닫기`}
                disabled={isSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <form
                  id="desktop-join-approved-action-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (confirmActionType) {
                      void handleSubmitAction(confirmActionType);
                    }
                  }}
                >
                  <Typography variant="body2">{getConfirmActionMessage()}</Typography>
                </form>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={handleCloseConfirmAction}
                  disabled={isSubmitting}
                >
                  취소
                </button>
                <button
                  type="submit"
                  form="desktop-join-approved-action-form"
                  className={confirmActionType === 'approve' ? undefined : 'danger-button'}
                  disabled={isSubmitting}
                >
                  {getConfirmActionButtonLabel()}
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
