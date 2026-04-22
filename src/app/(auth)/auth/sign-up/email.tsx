'use client';

import { useEffect, useState, type JSX } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Box, Button, Link, Paper, Stack, TextField } from '@mui/material';
import Anchor from '@/components/Anchor';
import { getSupabaseBrowser } from '@/lib/supabase';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type InviteResponse = {
  ok: boolean;
  invite: {
    email: string;
  };
  site: {
    site_key: string;
  };
};

type AcceptInviteResponse = {
  ok: boolean;
  siteName: string;
};

export default function EmailSignUp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseBrowser();

  const inviteToken = searchParams.get('inviteToken')?.trim() ?? '';
  const inviteSiteName = searchParams.get('siteName')?.trim().toLowerCase() ?? '';

  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [isInviteEmailLocked, setIsInviteEmailLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInviteLoading, setIsInviteLoading] = useState(false);

  useEffect(() => {
    async function loadInvite() {
      if (!inviteToken) {
        return;
      }

      try {
        setIsInviteLoading(true);
        setErrorMessage('');

        const response = await fetch(`/api/manage/design/blog/team/invite/${inviteToken}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as InviteResponse | { error?: string };

        if (!response.ok) {
          throw new Error(
            'error' in result ? result.error || '초대 정보를 불러오지 못했습니다.' : '초대 정보를 불러오지 못했습니다.',
          );
        }

        if (!('invite' in result) || !result.invite?.email) {
          throw new Error('초대 정보를 불러오지 못했습니다.');
        }

        setEmail(result.invite.email);
        setIsInviteEmailLocked(true);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '초대 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('초대 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsInviteLoading(false);
      }
    }

    void loadInvite();
  }, [inviteToken]);

  function handleUserNameChange(event: InputChangeEvent) {
    setUserName(event.currentTarget.value);
  }

  function handleEmailChange(event: InputChangeEvent) {
    if (isInviteEmailLocked) {
      return;
    }

    setEmail(event.currentTarget.value);
  }

  function handlePasswordChange(event: InputChangeEvent) {
    setPassword(event.currentTarget.value);
  }

  function handlePasswordConfirmChange(event: InputChangeEvent) {
    setPasswordConfirm(event.currentTarget.value);
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting || isInviteLoading) {
      return;
    }

    const trimmedUserName = userName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedUserName) {
      setErrorMessage('이름을 입력해주세요.');
      return;
    }

    if (!trimmedEmail) {
      setErrorMessage('이메일을 입력해주세요.');
      return;
    }

    if (!password) {
      setErrorMessage('비밀번호를 입력해주세요.');
      return;
    }

    if (!passwordConfirm) {
      setErrorMessage('비밀번호 확인을 입력해주세요.');
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage('비밀번호가 일치하지 않습니다.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const signUpResult = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });

      if (signUpResult.error) {
        throw new Error(signUpResult.error.message);
      }

      const authUser = signUpResult.data.user;

      if (!authUser) {
        throw new Error('회원 정보를 가져오지 못했습니다.');
      }

      const saveResponse = await fetch('/api/auth/email/sign-up', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          authUserId: authUser.id,
          email: authUser.email ?? trimmedEmail,
          userName: trimmedUserName,
        }),
      });

      const saveResult = (await saveResponse.json()) as { error?: string };

      if (!saveResponse.ok) {
        throw new Error(saveResult.error ?? '회원가입 저장 처리에 실패했습니다.');
      }

      if (inviteToken) {
        const acceptInviteResponse = await fetch(`/api/manage/design/blog/team/invite/${inviteToken}`, {
          method: 'POST',
          credentials: 'include',
        });

        const acceptInviteResult = (await acceptInviteResponse.json()) as AcceptInviteResponse | { error?: string };

        if (!acceptInviteResponse.ok) {
          throw new Error(
            'error' in acceptInviteResult
              ? acceptInviteResult.error || '초대 처리에 실패했습니다.'
              : '초대 처리에 실패했습니다.',
          );
        }

        if (!('siteName' in acceptInviteResult) || !acceptInviteResult.siteName) {
          throw new Error('초대 처리에 실패했습니다.');
        }

        router.replace(`/${acceptInviteResult.siteName}`);
        return;
      }

      if (inviteSiteName) {
        router.replace(`/${inviteSiteName}`);
        return;
      }

      router.replace('/');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '회원가입 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('회원가입 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <TextField
            label="이메일"
            type="email"
            autoComplete="email"
            value={email}
            onChange={handleEmailChange}
            fullWidth
            InputProps={{
              readOnly: isInviteEmailLocked,
            }}
          />

          <TextField
            label="활동명"
            type="text"
            autoComplete="nickname"
            value={userName}
            onChange={handleUserNameChange}
            fullWidth
          />

          <TextField
            label="비밀번호"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={handlePasswordChange}
            fullWidth
          />

          <TextField
            label="비밀번호 확인"
            type="password"
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={handlePasswordConfirmChange}
            fullWidth
          />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Anchor
              href={
                inviteToken ? `/auth/sign-in?inviteToken=${inviteToken}&siteName=${inviteSiteName}` : '/auth/sign-in'
              }
            >
              로그인 하기
            </Anchor>
          </Box>

          <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
            <Button type="submit" variant="contained" disabled={isSubmitting || isInviteLoading} size="large">
              시작하기
            </Button>

            <Link href="/" sx={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}>
              라운지로 이동
            </Link>
          </Box>

          {errorMessage ? (
            <Alert severity="error" variant="filled">
              {errorMessage}
            </Alert>
          ) : null}
        </Stack>
      </Box>
    </Paper>
  );
}
