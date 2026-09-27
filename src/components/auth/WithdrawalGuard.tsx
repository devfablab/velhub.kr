'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { getSupabaseBrowser } from '@/lib/supabase';
import { ACCOUNT_WITHDRAWAL_GRACE_MS } from '@/lib/users/accountWithdrawal.shared';

type WithdrawalStatusResponse = {
  status?: string | null;
  requestedAt?: string | null;
  error?: string;
};

function getWithdrawalCompletionDate(requestedAt: string | null) {
  if (!requestedAt) return null;
  const requestedAtTime = new Date(requestedAt).getTime();
  if (Number.isNaN(requestedAtTime)) return null;

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  }).format(new Date(requestedAtTime + ACCOUNT_WITHDRAWAL_GRACE_MS));
}

export default function WithdrawalGuard({
  children,
  initialStatus,
  initialRequestedAt,
}: {
  children: ReactNode;
  initialStatus: string | null;
  initialRequestedAt: string | null;
}) {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [status, setStatus] = useState<string | null>(initialStatus);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setStatus(initialStatus);

    if (initialStatus === 'completed') {
      const supabase = getSupabaseBrowser();
      void supabase.auth.signOut({ scope: 'global' }).then(() => router.replace('/'));
    }
  }, [initialStatus, router]);

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

      if (result.error) throw new Error('로그아웃에 실패했습니다.\n잠시 후 다시 시도해 주세요.');

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
  const withdrawalCompletionDate = getWithdrawalCompletionDate(initialRequestedAt);
  const withdrawalMessage = withdrawalCompletionDate
    ? `${withdrawalCompletionDate}에 탈퇴가 확정됩니다. 계속 이용하려면 탈퇴 신청을 취소해 주세요.`
    : '탈퇴 신청일로부터 30일이 지나면 탈퇴가 확정됩니다. 계속 이용하려면 탈퇴 신청을 취소해 주세요.';

  return (
    <>
      {children}
      {isMobile ? (
        <Drawer anchor="bottom" open={isOpen} className="VhiDrawer-bottom VhiDrawer-bottom-service">
          <h2>탈퇴 신청한 계정입니다</h2>
          <div className="VhiDrawer-bottom-content">
            <Typography variant="body2">{withdrawalMessage}</Typography>
            {errorMessage ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{errorMessage}</span>
              </p>
            ) : null}
          </div>
          <div className="drawer-dialog-actions">
            <button
              type="button"
              className="button small cancel"
              onClick={handleLogout}
              disabled={isCanceling || isLoggingOut}
            >
              로그아웃하기
            </button>
            <button
              type="button"
              className="button small submit"
              onClick={handleCancelWithdrawal}
              disabled={isCanceling || isLoggingOut}
            >
              탈퇴신청 취소
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog open={isOpen} disableEscapeKeyDown fullWidth maxWidth="xs" className="vh-dialog vh-alert-dialog">
          <DialogTitle>탈퇴 신청한 계정입니다</DialogTitle>
          <DialogContent>
            <Typography variant="body2">{withdrawalMessage}</Typography>
            {errorMessage ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{errorMessage}</span>
              </p>
            ) : null}
          </DialogContent>
          <DialogActions>
            <button
              type="button"
              className="cancel-button"
              onClick={handleLogout}
              disabled={isCanceling || isLoggingOut}
            >
              로그아웃하기
            </button>
            <button type="button" onClick={handleCancelWithdrawal} disabled={isCanceling || isLoggingOut}>
              탈퇴신청 취소
            </button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
