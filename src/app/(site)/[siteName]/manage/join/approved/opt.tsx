'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import { useParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
import SearchIcon from '@mui/icons-material/Search';
import { formatDate, normalizeText } from '@/lib/utils';

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
    return null;
  }

  return (
    <Stack spacing={2.5}>
      <Typography variant="h5" component="h1">
        가입 신청 관리
      </Typography>

      {errorMessage ? (
        <Alert severity="error" variant="filled">
          {errorMessage}
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <TextField
            label="이메일 또는 별명"
            value={searchKeyword}
            onChange={handleSearchKeywordChange}
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
            onClick={() => handleSubmitAction('approve')}
            disabled={isSubmitting}
          >
            가입 승인
          </Button>
          <Button
            type="button"
            variant="outlined"
            color="error"
            onClick={() => handleSubmitAction('reject')}
            disabled={isSubmitting}
          >
            가입 거절
          </Button>
        </Stack>

        <TableContainer component={Paper} variant="outlined">
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
                    {user.rejectedAt && user.rejectedBy ? `${user.rejectedBy} (${formatDate(user.rejectedAt)})` : ''}
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
        </TableContainer>
      </Stack>

      <Dialog open={Boolean(selectedUser)} onClose={() => setSelectedUser(null)} fullWidth maxWidth="sm">
        <DialogTitle>가입 신청 답변</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {selectedUser?.answeredQuestions && selectedUser.answeredQuestions.length > 0 ? (
              selectedUser.answeredQuestions.map((item, index) => (
                <Paper key={`${item.questionId ?? 'question'}-${index}`} variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1}>
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
                </Paper>
              ))
            ) : (
              <Typography variant="body2">가입 신청 답변이 없습니다.</Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setSelectedUser(null)}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={2500}
        onClose={() => setSnackbarMessage('')}
        message={snackbarMessage}
      />
    </Stack>
  );
}
