'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase';

type ProcessingState = 'idle' | 'processing' | 'confirm' | 'failed';

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

function wait(delay: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delay);
  });
}

export default function Page() {
  const router = useRouter();
  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [pendingSocialSave, setPendingSocialSave] = useState<PendingSocialSave | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function waitForSession() {
      const supabase = getSupabaseBrowser();

      for (let attempt = 0; attempt < 20; attempt += 1) {
        const sessionResult = await supabase.auth.getSession();

        if (sessionResult.error) {
          throw new Error(sessionResult.error.message);
        }

        if (sessionResult.data.session) {
          return sessionResult.data.session;
        }

        await wait(250);
      }

      throw new Error('세션을 가져오지 못했습니다.');
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

      const socialSaveResult = await socialSaveResponse.json();

      if (!socialSaveResponse.ok) {
        await supabase.auth.signOut({
          scope: 'local',
        });

        throw new Error(socialSaveResult.error ?? '소셜 로그인 저장 처리에 실패했습니다.');
      }

      const assuranceLevelResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (assuranceLevelResult.error) {
        throw new Error(assuranceLevelResult.error.message);
      }

      const currentLevel = assuranceLevelResult.data.currentLevel;
      const nextLevel = assuranceLevelResult.data.nextLevel;

      if (currentLevel !== 'aal2' && nextLevel === 'aal2') {
        router.replace('/verify-2fa');
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
      setConfirmMessage('');

      try {
        const supabase = getSupabaseBrowser();
        const authSession = await waitForSession();

        if (isCancelled) {
          return;
        }

        const userResult = await supabase.auth.getUser();

        if (userResult.error) {
          throw new Error(userResult.error.message);
        }

        const authUser = userResult.data.user;

        if (!authUser) {
          throw new Error('사용자 정보를 가져오지 못했습니다.');
        }

        const primaryIdentity = authUser.identities?.[0];

        const provider =
          primaryIdentity?.provider ?? authUser.app_metadata?.provider ?? authUser.user_metadata?.provider ?? null;

        const providerAccountId = primaryIdentity?.id ?? authUser.user_metadata?.sub ?? null;

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
          }),
        });

        const socialCheckResult = await socialCheckResponse.json();

        if (!socialCheckResponse.ok) {
          await supabase.auth.signOut({
            scope: 'local',
          });

          throw new Error(socialCheckResult.error ?? '계정 정보를 확인하지 못했습니다.');
        }

        if (socialCheckResult.needsConfirm) {
          setPendingSocialSave(nextPendingSocialSave);
          setConfirmMessage(socialCheckResult.message);
          setProcessingState('confirm');
          return;
        }

        await saveSocialSignIn(nextPendingSocialSave);
      } catch (unknownError) {
        if (isCancelled) {
          return;
        }

        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '소셜 로그인 처리 중 오류가 발생했습니다.');
        } else {
          setErrorMessage('소셜 로그인 처리 중 오류가 발생했습니다.');
        }

        setProcessingState('failed');
      }
    }

    void handleCallback();

    return () => {
      isCancelled = true;
    };
  }, [router]);

  async function handleConfirmSocialLogin() {
    if (!pendingSocialSave) {
      return;
    }

    setErrorMessage('');
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

      const socialSaveResult = await socialSaveResponse.json();

      if (!socialSaveResponse.ok) {
        await supabase.auth.signOut({
          scope: 'local',
        });

        throw new Error(socialSaveResult.error ?? '소셜 로그인 저장 처리에 실패했습니다.');
      }

      const assuranceLevelResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (assuranceLevelResult.error) {
        throw new Error(assuranceLevelResult.error.message);
      }

      const currentLevel = assuranceLevelResult.data.currentLevel;
      const nextLevel = assuranceLevelResult.data.nextLevel;

      if (currentLevel !== 'aal2' && nextLevel === 'aal2') {
        router.replace('/verify-2fa');
        return;
      }

      router.replace('/');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '소셜 로그인 처리 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('소셜 로그인 처리 중 오류가 발생했습니다.');
      }

      setProcessingState('failed');
    }
  }

  async function handleCancelSocialLogin() {
    const supabase = getSupabaseBrowser();

    await supabase.auth.signOut({
      scope: 'local',
    });

    router.replace('/sign-in');
  }

  return (
    <main>
      <h1>소셜 로그인 처리</h1>

      {processingState === 'idle' || processingState === 'processing' ? <p>로그인 정보를 확인하고 있습니다.</p> : null}

      {processingState === 'confirm' ? (
        <div>
          <p>{confirmMessage}</p>
          <button type="button" onClick={handleConfirmSocialLogin}>
            소셜 로그인
          </button>
          <button type="button" onClick={handleCancelSocialLogin}>
            이메일 로그인
          </button>
        </div>
      ) : null}

      {processingState === 'failed' ? <p>{errorMessage}</p> : null}
    </main>
  );
}
