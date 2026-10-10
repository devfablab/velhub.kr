'use client';

import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import GitHubIcon from '@mui/icons-material/GitHub';
import GoogleIcon from '@mui/icons-material/Google';
import { Dialog, DialogActions, DialogContent, DialogTitle, Drawer, useMediaQuery, useTheme } from '@mui/material';
import { getSupabaseBrowser } from '@/lib/supabase';
import VhiKakao from '../icons/VhiKakao';
import VhiNaver from '../icons/VhiNaver';
import styles from '@/app/auth.module.sass';

type SocialProvider = 'kakao' | 'google' | 'github';

type SocialLoginButtonsProps = {
  excludeProviders?: SocialProvider[];
};

export default function SocialLoginButtons({ excludeProviders = [] }: SocialLoginButtonsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = getSupabaseBrowser();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  const inviteToken = searchParams.get('inviteToken')?.trim() ?? '';
  const siteName = searchParams.get('siteName')?.trim().toLowerCase() ?? '';
  const inviteType = searchParams.get('inviteType')?.trim().toLowerCase() ?? '';

  const [errorMessage, setErrorMessage] = useState('');
  const [isErrorPopupOpen, setIsErrorPopupOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const actionText = pathname === '/auth/sign-up' ? '시작하기' : '계속하기';
  const naverAuth = pathname === '/auth/sign-up' || pathname === '/auth/sign-in';
  const excludedProviderSet = new Set(excludeProviders);

  function rememberSelectedProvider(provider: SocialProvider) {
    sessionStorage.setItem('auth:social-provider', provider);
  }

  async function handleGoogleLogin() {
    if (isSubmitting) {
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);
    rememberSelectedProvider('google');

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
    } catch {
      setErrorMessage('Google 로그인을 시작하지 못했습니다.\n인터넷 연결을 확인한 뒤 다시 시도해 주세요.');

      setIsErrorPopupOpen(true);

      setIsSubmitting(false);
    }
  }

  async function handleGithubLogin() {
    if (isSubmitting) {
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);
    rememberSelectedProvider('github');

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
    } catch {
      setErrorMessage('GitHub 로그인을 시작하지 못했습니다.\n인터넷 연결을 확인한 뒤 다시 시도해 주세요.');

      setIsErrorPopupOpen(true);

      setIsSubmitting(false);
    }
  }

  async function handleKakaoLogin() {
    if (isSubmitting) {
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);
    rememberSelectedProvider('kakao');

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
    } catch {
      setErrorMessage('카카오 로그인을 시작하지 못했습니다.\n인터넷 연결을 확인한 뒤 다시 시도해 주세요.');

      setIsErrorPopupOpen(true);

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

      {!excludedProviderSet.has('kakao') ? (
        <button
          type="button"
          className={`button medium submit ${styles.button} ${styles.kakao}`}
          onClick={handleKakaoLogin}
          disabled={isSubmitting}
        >
          <VhiKakao />
          <span>카카오 아이디로 {actionText}</span>
        </button>
      ) : null}

      {!excludedProviderSet.has('google') ? (
        <button
          type="button"
          className={`button medium submit ${styles.button} ${styles.google}`}
          onClick={handleGoogleLogin}
          disabled={isSubmitting}
        >
          <GoogleIcon />
          <span>Google 아이디로 {actionText}</span>
        </button>
      ) : null}

      {!excludedProviderSet.has('github') ? (
        <button
          type="button"
          className={`button medium submit ${styles.button} ${styles.github}`}
          onClick={handleGithubLogin}
          disabled={isSubmitting}
        >
          <GitHubIcon />
          <span>GitHub 아이디로 {actionText}</span>
        </button>
      ) : null}

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isErrorPopupOpen}
          onClose={() => setIsErrorPopupOpen(false)}
          className="VhiDrawer-bottom VhiDrawer-bottom-service"
        >
          <h2>소셜 로그인 오류</h2>
          <button type="button" className="close-button" onClick={() => setIsErrorPopupOpen(false)} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">
            <ul>
              <li style={{ whiteSpace: 'pre-line' }}>{errorMessage}</li>
            </ul>
          </div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button medium close" onClick={() => setIsErrorPopupOpen(false)}>
              확인
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={isErrorPopupOpen}
          onClose={() => setIsErrorPopupOpen(false)}
          fullWidth
          maxWidth="xs"
          className="vh-dialog vh-alert-dialog"
        >
          <DialogTitle>소셜 로그인 오류</DialogTitle>
          <button type="button" className="close-button" onClick={() => setIsErrorPopupOpen(false)} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <ul>
              <li style={{ whiteSpace: 'pre-line' }}>{errorMessage}</li>
            </ul>
          </DialogContent>
          <DialogActions>
            <button type="button" onClick={() => setIsErrorPopupOpen(false)}>
              확인
            </button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}
