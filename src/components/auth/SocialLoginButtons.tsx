'use client';

import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Alert, Button, Paper, Stack } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import GitHubIcon from '@mui/icons-material/GitHub';
import { getSupabaseBrowser } from '@/lib/supabase';

export default function SocialLoginButtons() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = getSupabaseBrowser();

  const inviteToken = searchParams.get('inviteToken')?.trim() ?? '';
  const siteName = searchParams.get('siteName')?.trim().toLowerCase() ?? '';

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const actionText = pathname === '/auth/sign-up' ? '시작하기' : '로그인';

  async function handleGoogleLogin() {
    if (isSubmitting) {
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const currentOrigin = window.location.origin;
      const redirectUrl = new URL('/auth/callback', currentOrigin);

      if (inviteToken) {
        redirectUrl.searchParams.set('inviteToken', inviteToken);
      }

      if (siteName) {
        redirectUrl.searchParams.set('siteName', siteName);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl.toString(),
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
      const redirectUrl = new URL('/auth/callback', currentOrigin);

      if (inviteToken) {
        redirectUrl.searchParams.set('inviteToken', inviteToken);
      }

      if (siteName) {
        redirectUrl.searchParams.set('siteName', siteName);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: redirectUrl.toString(),
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
    <Paper variant="outlined" sx={{ p: 3 }}>
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

        {errorMessage ? (
          <Alert severity="error" variant="filled">
            {errorMessage}
          </Alert>
        ) : null}
      </Stack>
    </Paper>
  );
}
