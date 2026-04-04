'use client';

import { usePathname } from 'next/navigation';
import { Alert, Button, Paper, Stack } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import GitHubIcon from '@mui/icons-material/GitHub';
import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';

export default function SocialLoginButtons() {
  const pathname = usePathname();
  const supabase = getSupabaseBrowser();

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const actionText = pathname === '/sign-up' ? '시작하기' : '로그인';

  async function handleGoogleLogin() {
    if (isSubmitting) {
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const currentOrigin = window.location.origin;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${currentOrigin}/auth/callback`,
        },
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || 'Google 로그인 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('Google 로그인 중 오류가 발생했습니다.');
      }

      setIsSubmitting(false);
    }
  }

  async function handleGithubLogin() {
    if (isSubmitting) {
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const currentOrigin = window.location.origin;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${currentOrigin}/auth/callback`,
        },
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || 'GitHub 로그인 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('GitHub 로그인 중 오류가 발생했습니다.');
      }

      setIsSubmitting(false);
    }
  }

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Stack spacing={1.5}>
        <Button
          type="button"
          variant="outlined"
          onClick={handleGoogleLogin}
          disabled={isSubmitting}
          fullWidth
          startIcon={<GoogleIcon />}
        >
          Google 아이디로 {actionText}
        </Button>

        <Button
          type="button"
          variant="outlined"
          onClick={handleGithubLogin}
          disabled={isSubmitting}
          fullWidth
          startIcon={<GitHubIcon />}
        >
          GitHub 아이디로 {actionText}
        </Button>

        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      </Stack>
    </Paper>
  );
}
