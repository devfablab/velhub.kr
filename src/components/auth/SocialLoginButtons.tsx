'use client';

import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import GoogleIcon from '@mui/icons-material/Google';
import GitHubIcon from '@mui/icons-material/GitHub';
import { getSupabaseBrowser } from '@/lib/supabase';
import VhiNaver from '../icons/VhiNaver';
import VhiKakao from '../icons/VhiKakao';
import styles from '@/app/auth.module.sass';

export default function SocialLoginButtons() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = getSupabaseBrowser();

  const inviteToken = searchParams.get('inviteToken')?.trim() ?? '';
  const siteName = searchParams.get('siteName')?.trim().toLowerCase() ?? '';
  const inviteType = searchParams.get('inviteType')?.trim().toLowerCase() ?? '';

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const actionText = pathname === '/auth/sign-up' ? '시작하기' : '계속하기';
  const naverAuth = pathname === '/auth/sign-up' || pathname === '/auth/sign-in';

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

      if (inviteType) {
        redirectUrl.searchParams.set('inviteType', inviteType);
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

      if (inviteType) {
        redirectUrl.searchParams.set('inviteType', inviteType);
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

  async function handleKakaoLogin() {
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

      if (inviteType) {
        redirectUrl.searchParams.set('inviteType', inviteType);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: redirectUrl.toString(),
        },
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '카카오 로그인 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('카카오 로그인 중 오류가 발생했습니다.');
      }

      setIsSubmitting(false);
    }
  }

  function handleNaverLogin() {
    if (isSubmitting) {
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    const naverLoginUrl = new URL('/api/auth/naver/start', window.location.origin);

    if (inviteToken) {
      naverLoginUrl.searchParams.set('inviteToken', inviteToken);
    }

    if (siteName) {
      naverLoginUrl.searchParams.set('siteName', siteName);
    }

    if (inviteType) {
      naverLoginUrl.searchParams.set('inviteType', inviteType);
    }

    window.location.href = naverLoginUrl.toString();
  }

  return (
    <div className={styles.socials}>
      {naverAuth ? (
        <button
          type="button"
          className={`button medium submit ${styles.button} ${styles.naver}`}
          onClick={handleNaverLogin}
          disabled={isSubmitting}
        >
          <VhiNaver />
          <span>네이버 아이디로 {actionText}</span>
        </button>
      ) : null}

      <button
        type="button"
        className={`button medium submit ${styles.button} ${styles.kakao}`}
        onClick={handleKakaoLogin}
        disabled={isSubmitting}
      >
        <VhiKakao />
        <span>카카오 아이디로 {actionText}</span>
      </button>

      <button
        type="button"
        className={`button medium submit ${styles.button} ${styles.google}`}
        onClick={handleGoogleLogin}
        disabled={isSubmitting}
      >
        <GoogleIcon />
        <span>Google 아이디로 {actionText}</span>
      </button>

      <button
        type="button"
        className={`button medium submit ${styles.button} ${styles.github}`}
        onClick={handleGithubLogin}
        disabled={isSubmitting}
      >
        <GitHubIcon />
        <span>GitHub 아이디로 {actionText}</span>
      </button>

      {errorMessage ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{errorMessage}</span>
        </p>
      ) : null}
    </div>
  );
}
