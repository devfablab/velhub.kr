'use client';

import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import GitHubIcon from '@mui/icons-material/GitHub';
import GoogleIcon from '@mui/icons-material/Google';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  useMediaQuery,
  useTheme,
  Tooltip,
} from '@mui/material';
import { getSupabaseBrowser } from '@/lib/clients/supabase';
import { LoadingIndicator } from '@/components/LoadingIndicator';
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
  const [submittingProvider, setSubmittingProvider] = useState('');

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
    setSubmittingProvider('google');
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
    setSubmittingProvider('github');
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
    setSubmittingProvider('kakao');
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
    setSubmittingProvider('naver');
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
          {isSubmitting && submittingProvider === 'naver' ? <LoadingIndicator size={20} /> : null}
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
          {isSubmitting && submittingProvider === 'kakao' ? <LoadingIndicator size={20} /> : null}
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
          {isSubmitting && submittingProvider === 'google' ? <LoadingIndicator size={20} /> : null}
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
          {isSubmitting && submittingProvider === 'github' ? <LoadingIndicator size={20} /> : null}
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
          slotProps={{ paper: { 'aria-labelledby': 'components-auth-social-login-buttons-drawer-title' } }}
        >
          <h2 id="components-auth-social-login-buttons-drawer-title">소셜 로그인 오류</h2>
          <Tooltip title="닫기">
            <button type="button" className="close-button" onClick={() => setIsErrorPopupOpen(false)}>
              <CloseRoundedIcon />
            </button>
          </Tooltip>
          <div className="VhiDrawer-bottom-content">
            <p style={{ whiteSpace: 'pre-line' }}>{errorMessage}</p>
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
          <Tooltip title="닫기">
            <button type="button" className="close-button" onClick={() => setIsErrorPopupOpen(false)}>
              <CloseRoundedIcon />
            </button>
          </Tooltip>
          <DialogContent>
            <p style={{ whiteSpace: 'pre-line' }}>{errorMessage}</p>
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
