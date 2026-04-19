'use client';

import { useEffect, useState, type JSX } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from '@mui/material/Link';
import {
  Alert,
  Button,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { normalizeText } from '@/lib/utils';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type CreateBoardResponse = {
  ok?: boolean;
  boardName?: string;
  error?: string;
};

const POST_PER_PAGE_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

function normalizeBoardKey(rawValue: string) {
  return rawValue
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
}

function hasInvalidBoardKeyCharacters(value: string) {
  return /[^a-z0-9-]/.test(value);
}

export default function Opt() {
  const router = useRouter();
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));
  const isMobile = !isNotMobile;

  const [boardLabel, setBoardLabel] = useState('');
  const [boardKey, setBoardKey] = useState('');
  const [postPerPage, setPostPerPage] = useState(5);
  const [isChecking, setIsChecking] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [checkedBoardKey, setCheckedBoardKey] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');

  function handleBoardLabelChange(event: InputChangeEvent) {
    setBoardLabel(event.currentTarget.value);
  }

  function handleBoardKeyChange(event: InputChangeEvent) {
    const normalizedValue = normalizeBoardKey(event.currentTarget.value);

    setBoardKey(normalizedValue);
    setIsChecked(false);
    setIsAvailable(false);
    setCheckedBoardKey('');
    setSuccessMessage('');
  }

  function handlePostPerPageChange(event: React.ChangeEvent<HTMLInputElement>) {
    setPostPerPage(Number(event.target.value));
  }

  async function handleCheckBoardKey() {
    const normalizedBoardKey = normalizeBoardKey(boardKey);

    if (!normalizedBoardKey) {
      setErrorMessage('게시판 식별자를 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    if (hasInvalidBoardKeyCharacters(normalizedBoardKey)) {
      setErrorMessage("영소문자, 하이픈('-'), 숫자만 사용 가능합니다.");
      setSuccessMessage('');
      return;
    }

    if (/^\d/.test(normalizedBoardKey)) {
      setErrorMessage('게시판 식별자는 숫자로 시작할 수 없습니다.');
      setSuccessMessage('');
      return;
    }

    if (normalizedBoardKey.length < 5 || normalizedBoardKey.length > 15) {
      setErrorMessage('게시판 식별자는 5자 이상 15자 이하여야 합니다.');
      setSuccessMessage('');
      return;
    }

    try {
      setErrorMessage('');
      setSuccessMessage('');
      setIsChecking(true);

      const response = await fetch(`/api/boards/${normalizedBoardKey}?siteName=${siteName}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as { error?: string };

      if (response.ok) {
        setIsChecked(true);
        setIsAvailable(false);
        setCheckedBoardKey(normalizedBoardKey);
        setErrorMessage('이미 존재하는 게시판 식별자입니다.');
        setSuccessMessage('');
        return;
      }

      if (response.status === 404) {
        setIsChecked(true);
        setIsAvailable(true);
        setCheckedBoardKey(normalizedBoardKey);
        setErrorMessage('');
        setSuccessMessage('사용 가능한 게시판 식별자입니다.');
        return;
      }

      throw new Error(result.error ?? '게시판 식별자 확인에 실패했습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '게시판 식별자 확인에 실패했습니다.');
      } else {
        setErrorMessage('게시판 식별자 확인에 실패했습니다.');
      }
      setSuccessMessage('');
      setIsChecked(false);
      setIsAvailable(false);
      setCheckedBoardKey('');
    } finally {
      setIsChecking(false);
    }
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const normalizedBoardLabel = boardLabel.trim();
    const normalizedBoardKey = normalizeBoardKey(boardKey);

    if (!normalizedBoardLabel) {
      setErrorMessage('게시판 이름을 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    if (!normalizedBoardKey) {
      setErrorMessage('게시판 식별자를 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    if (!isChecked || !isAvailable || checkedBoardKey !== normalizedBoardKey) {
      setErrorMessage('게시판 식별자 중복 체크를 해주세요.');
      setSuccessMessage('');
      return;
    }

    try {
      setErrorMessage('');
      setSuccessMessage('');
      setIsSubmitting(true);

      const response = await fetch('/api/boards/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          boardKey: normalizedBoardKey,
          boardLabel: normalizedBoardLabel,
          boardType: 'community',
          isActive: true,
          markdownStatus: 'markdown_default',
          postPerPage,
        }),
      });

      const result = (await response.json()) as CreateBoardResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '게시판 개설에 실패했습니다.');
      }

      if (!result.boardName) {
        throw new Error('게시판 개설에 실패했습니다.');
      }

      router.replace(`/${siteName}/contents/posts/c/${result.boardName}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '게시판 개설에 실패했습니다.');
      } else {
        setErrorMessage('게시판 개설에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      {isNotMobile && (
        <Typography variant="h4" component="h1" sx={{ mb: 2.5 }}>
          게시판 만들기
        </Typography>
      )}

      <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
        <TextField
          label="게시판 식별자"
          value={boardKey}
          onChange={handleBoardKeyChange}
          fullWidth
          size="medium"
          helperText={`스텝 관리화면: ${baseUrl}/${siteName}/contents/posts/c/${boardKey}`}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  {baseUrl}/{siteName}/
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={handleCheckBoardKey}
                    disabled={isChecking}
                    size="small"
                  >
                    중복 확인
                  </Button>
                </InputAdornment>
              ),
            },
          }}
        />

        <TextField label="게시판 이름" value={boardLabel} onChange={handleBoardLabelChange} fullWidth size="small" />

        <TextField
          select
          label="목록 표시 개수"
          value={postPerPage}
          onChange={handlePostPerPageChange}
          fullWidth
          size="small"
        >
          {POST_PER_PAGE_OPTIONS.map((count) => (
            <MenuItem key={count} value={count}>
              {count}개씩
            </MenuItem>
          ))}
        </TextField>

        <Stack direction="row" spacing={1.5} justifyContent="flex-end">
          <Button component={Link} href={`/${siteName}/contents/posts`} underline="none" variant="outlined">
            취소
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            저장
          </Button>
        </Stack>

        {errorMessage ? (
          <Alert severity="error" variant="filled">
            {errorMessage}
          </Alert>
        ) : null}
        {successMessage ? (
          <Alert severity="success" variant="outlined">
            {successMessage}
          </Alert>
        ) : null}
      </Stack>
    </Paper>
  );
}
