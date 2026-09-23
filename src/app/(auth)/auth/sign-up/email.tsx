'use client';

import { type JSX, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { Box, FormControlLabel, Stack, Switch, TextField } from '@mui/material';
import { getSupabaseBrowser } from '@/lib/supabase';
import Anchor from '@/components/Anchor';
import { SignupAgreementFields, useSignupAgreements } from '@/components/auth/SignupAgreements';
import styles from '@/app/auth.module.sass';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type AcceptInviteResponse = {
  ok: boolean;
  siteName: string;
};

const isDevelopment = process.env.NODE_ENV === 'development';

export default function EmailSignUp({
  initialInviteEmail = '',
  initialInviteError = '',
}: {
  initialInviteEmail?: string;
  initialInviteError?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseBrowser();
  const { canSubmit, isAgreeTerm, isAgreeChild, isAgreePrivacy } = useSignupAgreements();

  const inviteToken = searchParams.get('inviteToken')?.trim() ?? '';
  const inviteSiteName = searchParams.get('siteName')?.trim().toLowerCase() ?? '';
  const inviteType = searchParams.get('inviteType')?.trim().toLowerCase() ?? '';

  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState(initialInviteEmail);
  const isInviteEmailLocked = Boolean(initialInviteEmail);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [bypassEmailConfirm, setBypassEmailConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialInviteError);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    if (isSubmitting) {
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

    if (!canSubmit) {
      setErrorMessage('필수 동의 항목에 모두 동의해 주세요.');
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage('비밀번호가 일치하지 않습니다.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const emailResponse = await fetch('/api/notifications/email/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'signup',
          email: trimmedEmail,
          password,
          bypassEmailConfirm: isDevelopment ? bypassEmailConfirm : false,
        }),
      });
      const emailResult = (await emailResponse.json()) as { authUserId?: string; error?: string };

      if (!emailResponse.ok || !emailResult.authUserId) {
        throw new Error(emailResult.error || '이메일 인증 메일을 보내지 못했습니다.');
      }

      const saveResponse = await fetch('/api/auth/email/sign-up', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          authUserId: emailResult.authUserId,
          email: trimmedEmail,
          userName: trimmedUserName,
          isAgreeTerm,
          isAgreeChild,
          isAgreePrivacy,
          bypassEmailConfirm: isDevelopment ? bypassEmailConfirm : false,
        }),
      });

      const saveResult = (await saveResponse.json()) as { error?: string };

      if (!saveResponse.ok) {
        throw new Error(saveResult.error ?? '회원가입 저장 처리에 실패했습니다.');
      }

      if (isDevelopment && bypassEmailConfirm) {
        const signInResult = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (signInResult.error) {
          throw new Error(signInResult.error.message);
        }
      }

      if (inviteToken && inviteType === 'community') {
        router.replace(`/${inviteSiteName}/invite-community/${inviteToken}`);
        return;
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
      setIsSubmitting(false);
    }
  }

  const inviteParams = new URLSearchParams();

  if (inviteToken) {
    inviteParams.set('inviteToken', inviteToken);
  }

  if (inviteSiteName) {
    inviteParams.set('siteName', inviteSiteName);
  }

  if (inviteType) {
    inviteParams.set('inviteType', inviteType);
  }

  const signInHref = inviteParams.toString() ? `/auth/sign-in?${inviteParams.toString()}` : '/auth/sign-in';

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack gap={1}>
        <TextField
          placeholder="이메일"
          type="email"
          autoComplete="email"
          value={email}
          onChange={handleEmailChange}
          fullWidth
          size="small"
        />

        <TextField
          placeholder="활동명"
          type="text"
          autoComplete="nickname"
          value={userName}
          onChange={handleUserNameChange}
          fullWidth
          size="small"
        />

        <TextField
          placeholder="비밀번호"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={handlePasswordChange}
          fullWidth
          size="small"
        />

        <TextField
          placeholder="비밀번호 확인"
          type="password"
          autoComplete="new-password"
          value={passwordConfirm}
          onChange={handlePasswordConfirmChange}
          fullWidth
          size="small"
        />

        <SignupAgreementFields />

        {isDevelopment ? (
          <FormControlLabel
            control={
              <Switch checked={bypassEmailConfirm} onChange={(event) => setBypassEmailConfirm(event.target.checked)} />
            }
            label="이메일 인증 바이패스"
          />
        ) : null}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Anchor href={signInHref} className={`button small action ${styles.action}`}>
            로그인 하기
          </Anchor>
        </Box>

        <div className={styles.actions}>
          <button type="submit" className={`button medium submit ${styles.submit}`} disabled={isSubmitting}>
            이메일로 시작하기
          </button>
        </div>

        {errorMessage ? (
          <p className={`alert error ${styles.alert}`}>
            <ErrorOutlineRoundedIcon />
            <span>{errorMessage}</span>
          </p>
        ) : null}
      </Stack>
    </Box>
  );
}
