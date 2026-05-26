'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
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
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchIcon from '@mui/icons-material/Search';
import { formatDate, normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
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
  email: string;
  userName: string;
  nickname: string;
  createdAt: string;
  rejectedAt: string | null;
  rejectedBy: string;
  isReApproval: boolean;
  answeredQuestions: AnsweredQuestionRow[];
};

type JoinApprovedResponse = {
  ok?: boolean;
  users?: JoinApplicantRow[];
  error?: string;
};

type ActionType = 'approve' | 'reject' | null;

function formatDateKorean(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const [users, setUsers] = useState<JoinApplicantRow[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<JoinApplicantRow | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [confirmActionType, setConfirmActionType] = useState<ActionType>(null);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

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

  useEffect(() => {
    async function init() {
      try {
        setErrorMessage('');
        await loadUsers();
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '가입 신청 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('가입 신청 정보를 불러오지 못했습니다.');
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

    return users.filter((user) => {
      const email = normalizeText(user.email).toLowerCase();
      const userName = normalizeText(user.userName).toLowerCase();
      const nickname = normalizeText(user.nickname).toLowerCase();

      return email.includes(keyword) || userName.includes(keyword) || nickname.includes(keyword);
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
      setErrorMessage(
        nextActionType === 'approve' ? '가입 승인할 멤버를 선택해주세요.' : '가입 거절할 멤버를 선택해주세요.',
      );
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
      setErrorMessage(action === 'approve' ? '가입 승인할 멤버를 선택해주세요.' : '가입 거절할 멤버를 선택해주세요.');
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
        setErrorMessage(
          unknownError.message ||
            (action === 'approve' ? '가입 승인 처리에 실패했습니다.' : '가입 거절 처리에 실패했습니다.'),
        );
      } else {
        setErrorMessage(action === 'approve' ? '가입 승인 처리에 실패했습니다.' : '가입 거절 처리에 실패했습니다.');
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
                placeholder="이메일 또는 별명"
                value={searchKeyword}
                onChange={handleSearchKeywordChange}
                fullWidth
                size="small"
              />
              <button
                type="button"
                className="button medium action"
                onClick={handleSearch}
                aria-label="이메일 또는 별명으로 검색"
              >
                <SearchRoundedIcon />
              </button>
            </Stack>
          </div>

          <Stack spacing={1.5}>
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              justifyContent="space-between"
              sx={{ p: 2, pb: 0 }}
            >
              <button
                type="button"
                className="button small action"
                onClick={() => handleOpenConfirmAction('approve')}
                disabled={isSubmitting}
              >
                가입 승인
              </button>
              <button
                type="button"
                className="button small warning"
                onClick={() => handleOpenConfirmAction('reject')}
                disabled={isSubmitting}
              >
                가입 거절
              </button>
            </Stack>

            <div className={`paper ${styles.paper}`}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox checked={allFilteredSelected} onChange={handleToggleAll} />
                    </TableCell>
                    <TableCell>별명</TableCell>
                    <TableCell>가입신청일</TableCell>
                    <TableCell>거절</TableCell>
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
                      <TableCell>
                        {user.nickname || user.userName || user.email}
                        {user.isReApproval ? ' (재신청)' : ''}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography>{formatDateKorean(user.createdAt)}</Typography>
                          <IconButton size="small" onClick={() => setSelectedUser(user)}>
                            <SearchIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {user.rejectedAt && user.rejectedBy
                          ? `${user.rejectedBy} (${formatDate(user.rejectedAt)})`
                          : ''}
                      </TableCell>
                    </TableRow>
                  ))}

                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
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

              <Stack gap={3}>
                <div className={`paper ${styles['paper-sub']}`}>
                  {selectedUser?.answeredQuestions && selectedUser.answeredQuestions.length > 0 ? (
                    selectedUser.answeredQuestions.map((item, index) => (
                      <div key={`${item.questionId ?? 'question'}-${index}`} className={styles['question-item']}>
                        <Stack gap={1}>
                          <Typography variant="subtitle2">{item.question || `질문 ${index + 1}`}</Typography>

                          {item.type === 'objective' ? (
                            <Typography variant="body2">{item.answers.join(', ')}</Typography>
                          ) : item.imageUrls.length > 0 || item.imageUrl ? (
                            <Stack spacing={1}>
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

                <Stack direction="column" spacing={1.5}>
                  <button type="button" className="button medium cancel" onClick={() => setSelectedUser(null)}>
                    닫기
                  </button>
                </Stack>
              </Stack>
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
                            <Stack spacing={1}>
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
                <button type="button" className="button medium close" onClick={() => setSelectedUser(null)}>
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
              className="VhiDrawer-bottom"
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

              <Stack gap={3}>
                <Typography variant="body2">{getConfirmActionMessage()}</Typography>
                <Stack direction="column" spacing={1.5}>
                  <button
                    type="button"
                    className="button medium cancel"
                    onClick={handleCloseConfirmAction}
                    disabled={isSubmitting}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className={confirmActionType === 'approve' ? 'button medium submit' : 'button medium danger'}
                    onClick={() => {
                      if (confirmActionType) {
                        void handleSubmitAction(confirmActionType);
                      }
                    }}
                    disabled={isSubmitting}
                  >
                    {getConfirmActionButtonLabel()}
                  </button>
                </Stack>
              </Stack>
            </Drawer>
          ) : (
            <Dialog
              open={Boolean(confirmActionType)}
              onClose={handleCloseConfirmAction}
              fullWidth
              maxWidth="xs"
              className="VhiDialog"
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
                <Typography variant="body2">{getConfirmActionMessage()}</Typography>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="button medium close"
                  onClick={handleCloseConfirmAction}
                  disabled={isSubmitting}
                >
                  취소
                </button>
                <button
                  type="button"
                  className={confirmActionType === 'approve' ? 'button medium submit' : 'button medium danger'}
                  onClick={() => {
                    if (confirmActionType) {
                      void handleSubmitAction(confirmActionType);
                    }
                  }}
                  disabled={isSubmitting}
                >
                  {getConfirmActionButtonLabel()}
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
