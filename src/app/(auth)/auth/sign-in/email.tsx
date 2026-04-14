'use client';

import { useState, type JSX } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Anchor from '@/components/Anchor';
import { getSupabaseBrowser } from '@/lib/supabase';
import HCaptchaBox from './hCaptcha';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type SignInDecision = 'idle' | 'confirm-enable-email-login' | 'confirm-email-login';
type AcceptInviteResponse = {
  ok: boolean;
  siteName: string;
};

export default function EmailSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseBrowser();

  const inviteToken = searchParams.get('inviteToken')?.trim() ?? '';
  const inviteSiteName = searchParams.get('siteName')?.trim().toLowerCase() ?? '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [isCaptchaRequired, setIsCaptchaRequired] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [decisionMessage, setDecisionMessage] = useState('');
  const [decisionState, setDecisionState] = useState<SignInDecision>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleEmailChange(event: InputChangeEvent) {
    setEmail(event.currentTarget.value);
  }

  function handlePasswordChange(event: InputChangeEvent) {
    setPassword(event.currentTarget.value);
  }

  async function runInviteAccept() {
    if (!inviteToken) {
      return false;
    }

    const acceptInviteResponse = await fetch(`/api/design/blog/team/invite/${inviteToken}`, {
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
    return true;
  }

  async function runSignIn(trimmedEmail: string) {
    const signInResponse = await fetch('/api/auth/email/sign-in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        email: trimmedEmail,
        password,
        captchaToken: captchaToken || null,
      }),
    });

    const signInResult = await signInResponse.json();

    if (!signInResponse.ok) {
      setIsCaptchaRequired(Boolean(signInResult.captchaRequired));

      if (Boolean(signInResult.captchaRequired)) {
        setCaptchaResetKey((previousValue) => previousValue + 1);
      }

      throw new Error(signInResult.error ?? '로그인 중 오류가 발생했습니다.');
    }

    const setSessionResult = await supabase.auth.setSession({
      access_token: signInResult.accessToken,
      refresh_token: signInResult.refreshToken,
    });

    if (setSessionResult.error) {
      throw new Error(setSessionResult.error.message);
    }

    const inviteAccepted = await runInviteAccept();

    if (inviteAccepted) {
      return;
    }

    const assuranceLevelResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (assuranceLevelResult.error) {
      throw new Error(assuranceLevelResult.error.message);
    }

    const currentLevel = assuranceLevelResult.data.currentLevel;
    const nextLevel = assuranceLevelResult.data.nextLevel;

    if (currentLevel !== 'aal2' && nextLevel === 'aal2') {
      router.replace('/auth/verify-2fa');
      return;
    }

    if (inviteSiteName) {
      router.replace(`/${inviteSiteName}`);
      return;
    }

    router.replace('/');
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setErrorMessage('이메일을 입력해주세요.');
      return;
    }

    if (!password) {
      setErrorMessage('비밀번호를 입력해주세요.');
      return;
    }

    if (isCaptchaRequired && !captchaToken) {
      setErrorMessage('hCaptcha 확인을 진행해주세요.');
      return;
    }

    setErrorMessage('');
    setDecisionMessage('');
    setDecisionState('idle');
    setIsSubmitting(true);

    try {
      const checkResponse = await fetch('/api/auth/email/sign-in/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: trimmedEmail,
        }),
      });

      const checkResult = await checkResponse.json();

      if (!checkResponse.ok) {
        throw new Error(checkResult.error ?? '계정 정보를 확인하지 못했습니다.');
      }

      if (checkResult.accountType === 'social' && checkResult.hasPassword === false) {
        setDecisionState('confirm-enable-email-login');
        setDecisionMessage(
          '이 계정은 소셜 로그인으로 가입되어 있습니다. 이메일 로그인도 사용할 수 있도록 비밀번호 설정 메일을 보내시겠습니까?',
        );
        setIsSubmitting(false);
        return;
      }

      if (checkResult.accountType === 'social' && checkResult.hasPassword === true) {
        setDecisionState('confirm-email-login');
        setDecisionMessage('이미 소셜 로그인으로 가입한 계정입니다. 그래도 이메일로 로그인하시겠습니까?');
        setIsSubmitting(false);
        return;
      }

      await runSignIn(trimmedEmail);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '로그인 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('로그인 중 오류가 발생했습니다.');
      }
      setIsSubmitting(false);
    }
  }

  async function handleConfirmEnableEmailLogin() {
    if (isSubmitting) {
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setErrorMessage('이메일을 입력해주세요.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const resetPasswordResult = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetPasswordResult.error) {
        throw new Error(resetPasswordResult.error.message);
      }

      setDecisionState('idle');
      setDecisionMessage(
        '비밀번호 설정 메일을 보냈습니다. 메일에서 비밀번호를 설정한 뒤 이메일 로그인하실 수 있습니다.',
      );
      setIsSubmitting(false);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '처리 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('처리 중 오류가 발생했습니다.');
      }
      setIsSubmitting(false);
    }
  }

  async function handleConfirmEmailLogin() {
    if (isSubmitting) {
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setErrorMessage('이메일을 입력해주세요.');
      return;
    }

    if (!password) {
      setErrorMessage('비밀번호를 입력해주세요.');
      return;
    }

    if (isCaptchaRequired && !captchaToken) {
      setErrorMessage('캡챠 확인을 진행해주세요.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await runSignIn(trimmedEmail);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '로그인 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('로그인 중 오류가 발생했습니다.');
      }
      setIsSubmitting(false);
    }
  }

  function handleCancelDecision() {
    if (isSubmitting) {
      return;
    }

    setDecisionState('idle');
    setDecisionMessage('');
  }

  return (
    <>
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
            />

            <TextField
              label="비밀번호"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={handlePasswordChange}
              fullWidth
            />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Anchor
                href={
                  inviteToken
                    ? `/auth/sign-up?inviteToken=${encodeURIComponent(inviteToken)}&siteName=${encodeURIComponent(inviteSiteName)}`
                    : '/auth/sign-up'
                }
              >
                회원가입
              </Anchor>
              <Anchor href="/auth/find-password">비밀번호 찾기</Anchor>
            </Box>

            {isCaptchaRequired ? (
              <Stack spacing={1}>
                <Typography variant="body2">로그인 실패가 누적되어 캡챠 확인이 필요합니다.</Typography>
                <HCaptchaBox onTokenChange={setCaptchaToken} resetKey={captchaResetKey} />
              </Stack>
            ) : null}

            <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <Button type="submit" variant="contained" disabled={isSubmitting} size="large">
                로그인
              </Button>

              <Link href="/" sx={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}>
                라운지로 이동
              </Link>
            </Box>

            {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
            {decisionState === 'idle' && decisionMessage ? <Alert severity="success">{decisionMessage}</Alert> : null}
          </Stack>
        </Box>
      </Paper>

      <Dialog
        open={decisionState === 'confirm-enable-email-login'}
        onClose={handleCancelDecision}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>이메일 로그인 설정</DialogTitle>
        <DialogContent>
          <Typography>{decisionMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button type="button" variant="outlined" onClick={handleCancelDecision} disabled={isSubmitting}>
            취소
          </Button>
          <Button type="button" variant="contained" onClick={handleConfirmEnableEmailLogin} disabled={isSubmitting}>
            비밀번호 설정 메일 보내기
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={decisionState === 'confirm-email-login'} onClose={handleCancelDecision} fullWidth maxWidth="xs">
        <DialogTitle>이메일 로그인 확인</DialogTitle>
        <DialogContent>
          <Typography>{decisionMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button type="button" variant="outlined" onClick={handleCancelDecision} disabled={isSubmitting}>
            취소
          </Button>
          <Button type="button" variant="contained" onClick={handleConfirmEmailLogin} disabled={isSubmitting}>
            이메일 로그인
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
