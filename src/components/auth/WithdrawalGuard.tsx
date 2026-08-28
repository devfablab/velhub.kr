'use client';

import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
import { getSupabaseBrowser } from '@/lib/supabase';
import { useAuthState } from '@/components/auth/AuthStateProvider';

type WithdrawalStatusResponse = {
  status?: string | null;
  requestedAt?: string | null;
  error?: string;
};

export default function WithdrawalGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const { isReady, isAuthenticated, authVersion } = useAuthState();
  const [status, setStatus] = useState<string | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadStatus = useCallback(async () => {
    if (!isReady || !isAuthenticated) {
      setStatus(null);
      return;
    }

    const response = await fetch('/api/account/withdrawal', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      setStatus(null);
      return;
    }

    const result = (await response.json()) as WithdrawalStatusResponse;
    const nextStatus = result.status ?? null;

    if (nextStatus === 'completed') {
      const supabase = getSupabaseBrowser();
      await supabase.auth.signOut({ scope: 'global' });
      router.replace('/');
      return;
    }

    setStatus(nextStatus);
  }, [isAuthenticated, isReady, router]);

  useEffect(() => {
    void loadStatus();
  }, [authVersion, loadStatus, pathname]);

  async function handleCancelWithdrawal() {
    if (isCanceling || isLoggingOut) {
      return;
    }

    try {
      setErrorMessage('');
      setIsCanceling(true);

      const response = await fetch('/api/account/withdrawal', {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = (await response.json()) as WithdrawalStatusResponse;

      if (!response.ok) {
        throw new Error(result.error || '탈퇴 신청 취소에 실패했습니다.');
      }

      setStatus(null);
      router.refresh();
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '탈퇴 신청 취소에 실패했습니다.');
      } else {
        setErrorMessage('탈퇴 신청 취소에 실패했습니다.');
      }
    } finally {
      setIsCanceling(false);
    }
  }

  async function handleLogout() {
    if (isCanceling || isLoggingOut) {
      return;
    }

    try {
      setErrorMessage('');
      setIsLoggingOut(true);
      const supabase = getSupabaseBrowser();
      const result = await supabase.auth.signOut({ scope: 'local' });

      if (result.error) {
        throw new Error(result.error.message);
      }

      router.replace('/');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '로그아웃에 실패했습니다.');
      } else {
        setErrorMessage('로그아웃에 실패했습니다.');
      }
      setIsLoggingOut(false);
    }
  }

  const isOpen = status === 'pending';

  return (
    <>
      {children}
      {isMobile ? (
        <Drawer anchor="bottom" open={isOpen} className="VhiDrawer-bottom">
          <h2>탈퇴 신청한 계정입니다</h2>
          <Stack gap={3}>
            <Typography variant="body2">
              탈퇴 신청일로부터 30일이 지나면 탈퇴가 확정됩니다. 계속 이용하려면 탈퇴 신청을 취소해주세요.
            </Typography>
            {errorMessage ? <p className="alert error">{errorMessage}</p> : null}
            <Stack direction="column" gap={1.5}>
              <button
                type="button"
                className="button medium cancel"
                onClick={handleLogout}
                disabled={isCanceling || isLoggingOut}
              >
                로그아웃하기
              </button>
              <button
                type="button"
                className="button medium submit"
                onClick={handleCancelWithdrawal}
                disabled={isCanceling || isLoggingOut}
              >
                탈퇴신청 취소
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog open={isOpen} disableEscapeKeyDown fullWidth maxWidth="xs" className="VhiDialog">
          <DialogTitle>탈퇴 신청한 계정입니다</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              탈퇴 신청일로부터 30일이 지나면 탈퇴가 확정됩니다. 계속 이용하려면 탈퇴 신청을 취소해주세요.
            </Typography>
            {errorMessage ? <p className="alert error">{errorMessage}</p> : null}
          </DialogContent>
          <DialogActions>
            <button
              type="button"
              className="button medium close"
              onClick={handleLogout}
              disabled={isCanceling || isLoggingOut}
            >
              로그아웃하기
            </button>
            <button
              type="button"
              className="button medium submit"
              onClick={handleCancelWithdrawal}
              disabled={isCanceling || isLoggingOut}
            >
              탈퇴신청 취소
            </button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
