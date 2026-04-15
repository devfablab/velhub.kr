'use client';

import { useState, type JSX } from 'react';
import Link from '@mui/material/Link';
import { useRouter } from 'next/navigation';
import { Alert, Button, InputAdornment, Paper, Stack, TextField } from '@mui/material';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type CreateBoardResponse = {
  ok?: boolean;
  boardName?: string;
  error?: string;
};

type Props = {
  siteName: string;
};

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

export default function Opt({ siteName }: Props) {
  const router = useRouter();

  const [boardLabel, setBoardLabel] = useState('');
  const [boardKey, setBoardKey] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [checkedBoardKey, setCheckedBoardKey] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
        <TextField label="게시판 이름" value={boardLabel} onChange={handleBoardLabelChange} fullWidth />

        <TextField
          label="게시판 식별자"
          value={boardKey}
          onChange={handleBoardKeyChange}
          fullWidth
          InputProps={{
            startAdornment: <InputAdornment position="start">/contents/posts/c/</InputAdornment>,
            endAdornment: (
              <InputAdornment position="end">
                <Button type="button" variant="outlined" onClick={handleCheckBoardKey} disabled={isChecking}>
                  중복 체크
                </Button>
              </InputAdornment>
            ),
          }}
        />

        <Stack direction="row" spacing={1.5}>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            저장
          </Button>

          <Button component={Link} href={`/${siteName}/contents/posts`} underline="none" variant="outlined">
            취소
          </Button>
        </Stack>

        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
      </Stack>
    </Paper>
  );
}
