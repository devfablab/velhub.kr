'use client';

import { useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type JoinResponse = {
  ok?: boolean;
  siteName?: string;
  error?: string;
};

type Props = {
  siteName: string;
};

export default function Opt({ siteName }: Props) {
  const router = useRouter();

  const [nickname, setNickname] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleNicknameChange(event: InputChangeEvent) {
    setNickname(event.currentTarget.value);
    setErrorMessage('');
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    try {
      setErrorMessage('');
      setIsSubmitting(true);

      const response = await fetch('/api/manage/members/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          nickname,
        }),
      });

      const result = (await response.json()) as JoinResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '가입에 실패했습니다.');
      }

      router.replace(`/${siteName}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '가입에 실패했습니다.');
      } else {
        setErrorMessage('가입에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
      <Typography variant="body2">닉네임은 선택입니다. 입력하지 않으면 기본 활동명이 자동으로 사용됩니다.</Typography>

      <TextField label="닉네임" value={nickname} onChange={handleNicknameChange} fullWidth size="small" />

      <Stack direction="row" justifyContent="flex-end">
        <Button type="submit" variant="contained" disabled={isSubmitting}>
          가입하기
        </Button>
      </Stack>

      {errorMessage ? (
        <Alert severity="error" variant="filled">
          {errorMessage}
        </Alert>
      ) : null}
    </Stack>
  );
}
