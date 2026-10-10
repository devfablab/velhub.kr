'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { clearChannelWorksCookies } from '@/lib/channelWorks/cookies.client';
import { getSupabaseBrowser } from '@/lib/supabase';
import SocialLoginButtons from '@/components/auth/SocialLoginButtons';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import styles from '@/app/auth.module.sass';

type ProcessingState = 'idle' | 'processing' | 'confirm' | 'failed';
type SocialProvider = 'kakao' | 'google' | 'github';

type PendingSocialSave = {
  authUserId: string;
  email: string;
  provider: string | null;
  providerAccountId: string | null;
  userName: string | null;
  avatar: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
};

type SocialApiResponse = {
  ok?: boolean;
  error?: string;
  errors?: string[];
  title?: string;
  needsConfirm?: boolean;
  needsSignup?: boolean;
  message?: string;
};

function getApiErrorMessage(result: SocialApiResponse | null, fallback: string) {
  if (result?.errors?.length) return result.errors.join('\n');
  return result?.error || fallback;
}

function getInviteQuery(inviteToken: string, inviteSiteName: string, inviteType: string) {
  const params = new URLSearchParams();
  if (inviteToken) params.set('inviteToken', inviteToken);
  if (inviteSiteName) params.set('siteName', inviteSiteName);
  if (inviteType) params.set('inviteType', inviteType);
  return params.toString();
}

class SocialFlowError extends Error {
  title: string;

  constructor(title: string, message: string) {
    super(message);
    this.name = 'SocialFlowError';
    this.title = title;
  }
}

function wait(delay: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delay);
  });
}

export default function Opt() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const inviteToken = searchParams.get('inviteToken')?.trim() ?? '';
  const inviteSiteName = searchParams.get('siteName')?.trim().toLowerCase() ?? '';
  const inviteType = searchParams.get('inviteType')?.trim().toLowerCase() ?? '';

  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [errorTitle, setErrorTitle] = useState('');
  const [isErrorPopupOpen, setIsErrorPopupOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [pendingSocialSave, setPendingSocialSave] = useState<PendingSocialSave | null>(null);
  const [failedProvider, setFailedProvider] = useState<SocialProvider | null>(null);

  const [returnPath, setReturnPath] = useState<string | null>(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  useEffect(() => {
    let isCancelled = false;

    const authError = searchParams.get('error');
    const authErrorDescription = searchParams.get('error_description') ?? '';

    if (
      authError === 'server_error' &&
      authErrorDescription.includes('Multiple accounts with the same email address in the same linking domain')
    ) {
      const selectedProvider = sessionStorage.getItem('auth:social-provider');

      if (selectedProvider === 'kakao' || selectedProvider === 'google' || selectedProvider === 'github') {
        setFailedProvider(selectedProvider);
      }

      setErrorMessage('같은 이메일로 이미 가입된 계정입니다. 기존에 사용하던 소셜 로그인으로 로그인해 주세요.');
      setErrorTitle('소셜 로그인 확인');
      setIsErrorPopupOpen(true);
      setProcessingState('failed');
      return () => {
        isCancelled = true;
      };
    }

    if (authError) {
      setErrorMessage('소셜 로그인이 취소되었거나 실패했습니다. 다시 시도해 주세요.');
      setErrorTitle('소셜 로그인 확인');
      setIsErrorPopupOpen(true);
      setProcessingState('failed');
      return () => {
        isCancelled = true;
      };
    }

    async function waitForSession() {
      const supabase = getSupabaseBrowser();

      for (let attempt = 0; attempt < 20; attempt += 1) {
        const sessionResult = await supabase.auth.getSession();

        if (sessionResult.error) {
          throw new Error('소셜 로그인 정보를 확인하지 못했습니다.\n잠시 후 다시 시도해 주세요.');
        }

        if (sessionResult.data.session) {
          return sessionResult.data.session;
        }

        await wait(250);
      }

      throw new Error('세션을 가져오지 못했습니다.');
    }

    async function runInviteAccept() {
      if (!inviteToken) {
        return false;
      }

      const invitePath = inviteType === 'community' ? 'invite-community' : 'invite-blog';
      router.replace(`/${inviteSiteName}/${invitePath}/${inviteToken}`);
      return true;
    }

    async function saveSocialSignIn(targetPendingSocialSave: PendingSocialSave) {
      const supabase = getSupabaseBrowser();

      const socialSaveResponse = await fetch('/api/auth/social', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(targetPendingSocialSave),
      });

      const socialSaveResult = (await socialSaveResponse.json().catch(() => null)) as SocialApiResponse | null;

      if (!socialSaveResponse.ok) {
        await supabase.auth.signOut({
          scope: 'local',
        });

        throw new SocialFlowError(
          socialSaveResult?.title ?? '',
          getApiErrorMessage(socialSaveResult, '소셜 로그인 저장 처리에 실패했습니다.'),
        );
      }

      if (inviteType !== 'community') {
        const inviteAccepted = await runInviteAccept();

        if (inviteAccepted) {
          return;
        }
      }

      const assuranceLevelResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (assuranceLevelResult.error) {
        throw new Error('2단계 인증 상태를 확인하지 못했습니다.\n잠시 후 다시 시도해 주세요.');
      }

      const currentLevel = assuranceLevelResult.data.currentLevel;
      const nextLevel = assuranceLevelResult.data.nextLevel;

      if (currentLevel !== 'aal2' && nextLevel === 'aal2') {
        const afterMfaPath =
          inviteToken && inviteSiteName
            ? `/${inviteSiteName}/${inviteType === 'community' ? 'invite-community' : 'invite-blog'}/${inviteToken}`
            : inviteSiteName
              ? `/${inviteSiteName}`
              : sessionStorage.getItem('route:returnPath') || '/';
        sessionStorage.setItem('auth:after-mfa', afterMfaPath);
        router.replace('/auth/verify-2fa');
        return;
      }

      if (inviteType === 'community' && inviteToken && inviteSiteName) {
        router.replace(`/${inviteSiteName}/invite-community/${inviteToken}`);
        return;
      }

      if (inviteSiteName) {
        router.replace(`/${inviteSiteName}`);
        return;
      }

      router.replace('/');
    }

    async function handleCallback() {
      if (isCancelled) {
        return;
      }

      setProcessingState('processing');
      setErrorMessage('');
      setErrorTitle('');
      setConfirmMessage('');

      try {
        const supabase = getSupabaseBrowser();
        const authSession = await waitForSession();

        clearChannelWorksCookies();

        const selectedProvider = sessionStorage.getItem('auth:social-provider');
        sessionStorage.removeItem('auth:social-provider');

        if (isCancelled) {
          return;
        }

        const userResult = await supabase.auth.getUser();

        if (userResult.error) {
          throw new Error('소셜 로그인 정보를 확인하지 못했습니다.\n잠시 후 다시 시도해 주세요.');
        }

        const authUser = userResult.data.user;

        if (!authUser) {
          throw new Error('사용자 정보를 가져오지 못했습니다.');
        }

        const primaryIdentity = authUser.identities?.[0];

        const metadataProvider =
          typeof authUser.user_metadata?.provider === 'string'
            ? authUser.user_metadata.provider.trim().toLowerCase()
            : '';
        const provider =
          metadataProvider === 'naver'
            ? 'naver'
            : selectedProvider === 'kakao' || selectedProvider === 'google' || selectedProvider === 'github'
              ? selectedProvider
              : (authUser.identities?.find((identity) => identity.provider !== 'email')?.provider ??
                  primaryIdentity?.provider ??
                  authUser.app_metadata?.provider ??
                  metadataProvider) ||
                null;

        const providerAccountId =
          provider === 'naver'
            ? typeof authUser.user_metadata?.naver_id === 'string'
              ? authUser.user_metadata.naver_id
              : null
            : (authUser.identities?.find((identity) => identity.provider === provider)?.id ??
              primaryIdentity?.id ??
              authUser.user_metadata?.sub ??
              null);

        const userName =
          authUser.user_metadata?.name ??
          authUser.user_metadata?.full_name ??
          authUser.user_metadata?.user_name ??
          authUser.user_metadata?.preferred_username ??
          null;

        const avatar =
          authUser.user_metadata?.avatar_url ??
          authUser.user_metadata?.picture ??
          authUser.user_metadata?.avatar ??
          null;

        const nextPendingSocialSave: PendingSocialSave = {
          authUserId: authUser.id,
          email: authUser.email as string,
          provider,
          providerAccountId,
          userName,
          avatar,
          accessToken: authSession.provider_token ?? null,
          refreshToken: authSession.provider_refresh_token ?? null,
          tokenExpiresAt: authSession.expires_at ?? null,
        };

        const socialCheckResponse = await fetch('/api/auth/social/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            email: nextPendingSocialSave.email,
            authUserId: nextPendingSocialSave.authUserId,
          }),
        });

        const socialCheckResult = (await socialCheckResponse.json().catch(() => null)) as SocialApiResponse | null;

        if (!socialCheckResponse.ok) {
          await supabase.auth.signOut({
            scope: 'local',
          });

          throw new SocialFlowError(
            socialCheckResult?.title ?? '로그인 정보 확인',
            getApiErrorMessage(socialCheckResult, '계정 정보를 확인하지 못했습니다.'),
          );
        }

        if (socialCheckResult?.needsConfirm) {
          setPendingSocialSave(nextPendingSocialSave);
          setConfirmMessage(socialCheckResult.message ?? '이 소셜 로그인을 기존 계정에 연결하시겠습니까?');
          setProcessingState('confirm');
          return;
        }

        if (socialCheckResult?.needsSignup) {
          const inviteQuery = getInviteQuery(inviteToken, inviteSiteName, inviteType);
          router.replace(`/auth/social-sign-up${inviteQuery ? `?${inviteQuery}` : ''}`);
          return;
        }

        await saveSocialSignIn(nextPendingSocialSave);
      } catch (unknownError) {
        if (isCancelled) {
          return;
        }

        setErrorMessage(
          unknownError instanceof Error && unknownError.message
            ? unknownError.message
            : '소셜 로그인 처리 중 오류가 발생했습니다.\n인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
        );
        setErrorTitle(unknownError instanceof SocialFlowError ? unknownError.title : '');
        setIsErrorPopupOpen(true);

        setProcessingState('failed');
      }
    }

    void handleCallback();

    return () => {
      isCancelled = true;
    };
  }, [router, searchParams, inviteToken, inviteSiteName, inviteType]);

  useEffect(() => {
    setReturnPath(sessionStorage.getItem('route:returnPath'));
  }, []);

  async function handleConfirmSocialLogin() {
    if (!pendingSocialSave) {
      return;
    }

    setErrorMessage('');
    setErrorTitle('');
    setProcessingState('processing');

    try {
      const supabase = getSupabaseBrowser();

      const socialSaveResponse = await fetch('/api/auth/social', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(pendingSocialSave),
      });

      const socialSaveResult = (await socialSaveResponse.json().catch(() => null)) as SocialApiResponse | null;

      if (!socialSaveResponse.ok) {
        await supabase.auth.signOut({
          scope: 'local',
        });

        throw new SocialFlowError(
          socialSaveResult?.title ?? '',
          getApiErrorMessage(socialSaveResult, '소셜 로그인 저장 처리에 실패했습니다.'),
        );
      }

      if (inviteToken) {
        const invitePath = inviteType === 'community' ? 'invite-community' : 'invite-blog';
        router.replace(`/${inviteSiteName}/${invitePath}/${inviteToken}`);
        return;
      }

      const assuranceLevelResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (assuranceLevelResult.error) {
        throw new Error('2단계 인증 상태를 확인하지 못했습니다.\n잠시 후 다시 시도해 주세요.');
      }

      const currentLevel = assuranceLevelResult.data.currentLevel;
      const nextLevel = assuranceLevelResult.data.nextLevel;

      if (currentLevel !== 'aal2' && nextLevel === 'aal2') {
        const afterMfaPath =
          inviteToken && inviteSiteName
            ? `/${inviteSiteName}/${inviteType === 'community' ? 'invite-community' : 'invite-blog'}/${inviteToken}`
            : inviteSiteName
              ? `/${inviteSiteName}`
              : returnPath || '/';
        sessionStorage.setItem('auth:after-mfa', afterMfaPath);
        router.replace('/auth/verify-2fa');
        return;
      }

      if (inviteSiteName) {
        router.replace(`/${inviteSiteName}`);
        return;
      }

      if (returnPath) {
        router.replace(returnPath);
        return;
      }

      router.replace('/');
    } catch (unknownError) {
      setErrorMessage(
        unknownError instanceof Error && unknownError.message
          ? unknownError.message
          : '소셜 로그인 처리 중 오류가 발생했습니다.\n인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
      );
      setErrorTitle(unknownError instanceof SocialFlowError ? unknownError.title : '');
      setIsErrorPopupOpen(true);

      setProcessingState('failed');
    }
  }

  async function handleCancelSocialLogin() {
    const supabase = getSupabaseBrowser();

    await supabase.auth.signOut({
      scope: 'local',
    });

    const params = new URLSearchParams();

    if (inviteToken) {
      params.set('inviteToken', inviteToken);
    }

    if (inviteSiteName) {
      params.set('siteName', inviteSiteName);
    }

    if (inviteType) {
      params.set('inviteType', inviteType);
    }

    router.replace(`/auth/sign-in${params.toString() ? `?${params.toString()}` : ''}`);
  }

  return (
    <main className={styles.callback}>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <h1>소셜 로그인 진행 중</h1>
          <div className={styles.processing}>
            {processingState === 'idle' || processingState === 'processing' ? (
              <Stack gap={5} alignItems="center">
                <p className={`alert info ${styles.alert}`}>
                  <InfoOutlineRoundedIcon />
                  <span>로그인 정보를 확인하고 있습니다.</span>
                </p>
                <LoadingIndicator />
              </Stack>
            ) : null}

            {processingState === 'failed' ? (
              <Stack gap={5} alignItems="center">
                <p className={`alert error ${styles.alert}`}>
                  <ErrorOutlineRoundedIcon />
                  <span>{errorMessage}</span>
                </p>
                <SocialLoginButtons excludeProviders={failedProvider ? [failedProvider] : []} />
              </Stack>
            ) : null}
          </div>
        </div>
      </div>

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={processingState === 'confirm'}
          onClose={handleCancelSocialLogin}
          className="VhiDrawer-bottom VhiDrawer-bottom-service"
        >
          <h2>소셜 로그인 확인</h2>
          <button className="close-button" onClick={handleCancelSocialLogin} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">
            <Typography variant="subtitle2">{confirmMessage}</Typography>
          </div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button medium action" onClick={handleCancelSocialLogin}>
              연결하지 않음
            </button>
            <button type="button" className="button medium action" onClick={handleConfirmSocialLogin}>
              연결 허용
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={processingState === 'confirm'}
          onClose={handleCancelSocialLogin}
          fullWidth
          maxWidth="xs"
          className="vh-dialog vh-alert-dialog"
        >
          <DialogTitle>소셜 로그인 확인</DialogTitle>
          <button className="close-button" onClick={handleCancelSocialLogin} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <Typography variant="subtitle2">{confirmMessage}</Typography>
          </DialogContent>
          <DialogActions>
            <button type="button" onClick={handleCancelSocialLogin}>
              연결하지 않음
            </button>
            <button type="button" onClick={handleConfirmSocialLogin}>
              연결 허용
            </button>
          </DialogActions>
        </Dialog>
      )}

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isErrorPopupOpen}
          onClose={() => setIsErrorPopupOpen(false)}
          className="VhiDrawer-bottom VhiDrawer-bottom-service"
        >
          {errorTitle ? <h2>{errorTitle}</h2> : null}
          <button type="button" className="close-button" onClick={() => setIsErrorPopupOpen(false)} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">
            {errorTitle ? (
              <ul>
                {errorMessage.split('\n').map((message, index) => (
                  <li key={`${index}-${message}`}>{message}</li>
                ))}
              </ul>
            ) : (
              <p className="alert popup-error">
                <ErrorOutlineRoundedIcon />
                <span style={{ whiteSpace: 'pre-line' }}>{errorMessage}</span>
              </p>
            )}
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
          {errorTitle ? <DialogTitle>{errorTitle}</DialogTitle> : null}
          <button type="button" className="close-button" onClick={() => setIsErrorPopupOpen(false)} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            {errorTitle ? (
              <ul>
                {errorMessage.split('\n').map((message, index) => (
                  <li key={`${index}-${message}`}>{message}</li>
                ))}
              </ul>
            ) : (
              <p className="alert popup-error">
                <ErrorOutlineRoundedIcon />
                <span style={{ whiteSpace: 'pre-line' }}>{errorMessage}</span>
              </p>
            )}
          </DialogContent>
          <DialogActions>
            <button type="button" onClick={() => setIsErrorPopupOpen(false)}>
              확인
            </button>
          </DialogActions>
        </Dialog>
      )}
    </main>
  );
}
