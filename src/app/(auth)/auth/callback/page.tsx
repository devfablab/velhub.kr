'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
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

type AcceptInviteResponse = {
  ok: boolean;
  siteName: string;
};

function wait(delay: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delay);
  });
}

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const inviteToken = searchParams.get('inviteToken')?.trim() ?? '';
  const inviteSiteName = searchParams.get('siteName')?.trim().toLowerCase() ?? '';

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

    async function runInviteAccept() {
      if (!inviteToken) {
        return false;
      }

      const acceptInviteResponse = await fetch(
        `/api/design/blog/team/invite/${inviteToken}?siteName=${inviteSiteName}`,
        {
          method: 'POST',
          credentials: 'include',
        },
      );

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
  }, [router, inviteToken, inviteSiteName]);

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

      if (inviteToken) {
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

    if (inviteToken) {
      router.replace(`/auth/sign-in?inviteToken=${inviteToken}&siteName=${inviteSiteName}`);
      return;
    }

    router.replace('/auth/sign-in');
  }

  return (
    <>
      <Container maxWidth="sm">
        <Box sx={{ py: 8 }}>
          <Stack spacing={4}>
            <Typography variant="h5" component="h1">
              소셜 로그인 처리
            </Typography>

            <Paper elevation={0} sx={{ p: 3 }}>
              {processingState === 'idle' || processingState === 'processing' ? (
                <Typography>로그인 정보를 확인하고 있습니다.</Typography>
              ) : null}

              {processingState === 'failed' ? (
                <Alert severity="error" variant="filled">
                  {errorMessage}
                </Alert>
              ) : null}
            </Paper>
          </Stack>
        </Box>
      </Container>

      <Dialog open={processingState === 'confirm'} onClose={handleCancelSocialLogin} fullWidth maxWidth="xs">
        <DialogTitle>소셜 로그인 확인</DialogTitle>
        <DialogContent>
          <Typography>{confirmMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button type="button" variant="outlined" onClick={handleCancelSocialLogin}>
            이메일 로그인
          </Button>
          <Button type="button" variant="contained" onClick={handleConfirmSocialLogin}>
            소셜 로그인
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
