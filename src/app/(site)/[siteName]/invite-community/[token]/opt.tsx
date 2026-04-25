'use client';

import { useEffect, useState, type JSX } from 'react';
import Anchor from '@/components/Anchor';
import { useParams, useRouter } from 'next/navigation';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { normalizeText } from '@/lib/utils';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type InviteResponse = {
  ok?: boolean;
  siteName?: string;
  joinNotice?: string;
  invite?: {
    email: string;
  };
  isLoggedIn?: boolean;
  isInvitedUser?: boolean;
  isAlreadyMember?: boolean;
  error?: string;
};

type AcceptInviteResponse = {
  ok?: boolean;
  siteName?: string;
  error?: string;
};

export default function Opt() {
  const params = useParams();
  const router = useRouter();

  const siteName = normalizeText(params.siteName).toLowerCase();
  const token = normalizeText(params.token);

  const [joinNotice, setJoinNotice] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInvitedUser, setIsInvitedUser] = useState(false);
  const [isAlreadyMember, setIsAlreadyMember] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadInvite() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/manage/join/invite/${token}?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as InviteResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '초대 정보를 불러오지 못했습니다.');
        }

        setJoinNotice(result.joinNotice ?? '');
        setInviteEmail(result.invite?.email ?? '');
        setIsLoggedIn(Boolean(result.isLoggedIn));
        setIsInvitedUser(Boolean(result.isInvitedUser));
        setIsAlreadyMember(Boolean(result.isAlreadyMember));
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '초대 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('초대 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadInvite();
  }, [siteName, token]);

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

      const response = await fetch(`/api/manage/join/invite/${token}?siteName=${siteName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          nickname,
        }),
      });

      const result = (await response.json()) as AcceptInviteResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '초대 처리에 실패했습니다.');
      }

      if (!result.siteName) {
        throw new Error('초대 처리에 실패했습니다.');
      }

      router.replace(`/${result.siteName}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '초대 처리에 실패했습니다.');
      } else {
        setErrorMessage('초대 처리에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return null;
  }

  if (isAlreadyMember) {
    return (
      <Stack spacing={2}>
        <Alert severity="info" variant="outlined">
          이미 가입된 멤버입니다.
        </Alert>

        <Box>
          <Button type="button" variant="contained" onClick={() => router.replace(`/${siteName}`)}>
            커뮤니티로 이동
          </Button>
        </Box>

        {errorMessage ? (
          <Alert severity="error" variant="filled">
            {errorMessage}
          </Alert>
        ) : null}
      </Stack>
    );
  }

  if (!isLoggedIn) {
    return (
      <Stack spacing={2.5}>
        {joinNotice ? (
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              가입 안내
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {joinNotice}
            </Typography>
          </Paper>
        ) : null}

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="body2">초대받은 이메일: {inviteEmail}</Typography>

            <Alert severity="info" variant="outlined">
              초대받은 이메일 계정으로 로그인 또는 회원가입 후 가입을 완료해주세요.
            </Alert>

            <Stack direction="row" spacing={1.5}>
              <Anchor href={`/auth/sign-in?inviteToken=${token}&siteName=${siteName}&inviteType=community`}>
                로그인
              </Anchor>
              <Anchor href={`/auth/sign-up?inviteToken=${token}&siteName=${siteName}&inviteType=community`}>
                회원가입
              </Anchor>
            </Stack>
          </Stack>
        </Paper>

        {errorMessage ? (
          <Alert severity="error" variant="filled">
            {errorMessage}
          </Alert>
        ) : null}
      </Stack>
    );
  }

  if (!isInvitedUser) {
    return (
      <Stack spacing={2}>
        {joinNotice ? (
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              가입 안내
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {joinNotice}
            </Typography>
          </Paper>
        ) : null}

        <Alert severity="error" variant="filled">
          초대받은 계정으로 로그인해주세요.
        </Alert>

        {errorMessage ? (
          <Alert severity="error" variant="filled">
            {errorMessage}
          </Alert>
        ) : null}
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      {joinNotice ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            가입 안내
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {joinNotice}
          </Typography>
        </Paper>
      ) : null}

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            <Typography variant="body2">
              닉네임은 선택입니다. 입력하지 않으면 기본 활동명이 자동으로 사용됩니다.
            </Typography>

            <TextField label="닉네임" value={nickname} onChange={handleNicknameChange} fullWidth size="small" />

            <Stack direction="row" justifyContent="flex-end">
              <Button type="submit" variant="contained" disabled={isSubmitting}>
                가입하기
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Paper>

      {errorMessage ? (
        <Alert severity="error" variant="filled">
          {errorMessage}
        </Alert>
      ) : null}
    </Stack>
  );
}
