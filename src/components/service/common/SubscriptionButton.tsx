'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type BoardInfo = {
  id: string;
  board_key: string;
  board_label: string;
};

type SelectedSeries = {
  series_key: string;
  series_label: string;
};

type SubscriptionTargetType = 'board' | 'series';
type SubscriptionStatus = 'none' | 'active' | 'scheduled_cancel' | 'canceled' | 'expired' | 'past_due';

type Props = {
  siteName: string;
  boardName: string;
  board: BoardInfo | null;
  selectedSeries: SelectedSeries | null;
};

type SubscriptionStatusResponse = {
  isEnabled?: boolean;
  price?: number | null;
  subscriptionStatus?: SubscriptionStatus;
  error?: string;
};

type SubscriptionStartResponse =
  | {
      mode: 'billing_auth';
      clientKey: string;
      customerKey: string;
      orderNo: string;
      orderName: string;
      amount: number;
      successUrl: string;
      failUrl: string;
    }
  | {
      mode: 'direct_billing';
      ok: true;
      subscriptionId: string;
      paymentId: string;
    }
  | {
      error: string;
    };

type SubscriptionActionResponse =
  | {
      ok: true;
      mode:
        | 'canceled_without_payment'
        | 'cancel_scheduled'
        | 'full_refund'
        | 'partial_refund'
        | 'resume_scheduled_cancel';
      refundAmount?: number;
      retainedAmount?: number;
      usedDays?: number;
      nextBillingAt?: string;
    }
  | {
      error: string;
    };

function formatPrice(value: number) {
  return value.toLocaleString('ko-KR');
}

function getSubscribeButtonText({
  targetType,
  subscriptionStatus,
}: {
  targetType: SubscriptionTargetType;
  subscriptionStatus: SubscriptionStatus;
}) {
  if (subscriptionStatus === 'canceled' || subscriptionStatus === 'expired') {
    return '재구독하기';
  }

  return targetType === 'series' ? '연재 구독' : '게시판 구독';
}

function getDialogTitle({
  targetType,
  subscriptionStatus,
}: {
  targetType: SubscriptionTargetType;
  subscriptionStatus: SubscriptionStatus;
}) {
  if (subscriptionStatus === 'canceled' || subscriptionStatus === 'expired') {
    return '재구독하기';
  }

  return targetType === 'series' ? '연재 구독' : '게시판 구독';
}

function getDialogSubmitText(subscriptionStatus: SubscriptionStatus) {
  if (subscriptionStatus === 'canceled' || subscriptionStatus === 'expired') {
    return '재구독하기';
  }

  return '구독하기';
}

export default function SubscriptionButton({ siteName, boardName, board, selectedSeries }: Props) {
  const targetType: SubscriptionTargetType = selectedSeries ? 'series' : 'board';
  const targetLabel = selectedSeries?.series_label ?? board?.board_label ?? '';

  const statusQueryString = useMemo(() => {
    const params = new URLSearchParams({
      siteName,
      boardName,
      targetType,
    });

    if (selectedSeries) {
      params.set('seriesName', selectedSeries.series_key);
    }

    return params.toString();
  }, [siteName, boardName, targetType, selectedSeries]);

  const [isEnabled, setIsEnabled] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('none');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    async function loadSubscriptionStatus() {
      try {
        setErrorMessage('');
        setIsEnabled(false);
        setPrice(null);
        setSubscriptionStatus('none');

        if (!board) {
          return;
        }

        const response = await fetch(`/api/payments/toss/subscriptions/status?${statusQueryString}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as SubscriptionStatusResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '구독 상태를 확인하지 못했습니다.');
        }

        setIsEnabled(Boolean(result.isEnabled));
        setPrice(result.price ?? null);
        setSubscriptionStatus(result.subscriptionStatus ?? 'none');
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '구독 상태를 확인하지 못했습니다.');
        } else {
          setErrorMessage('구독 상태를 확인하지 못했습니다.');
        }
      }
    }

    void loadSubscriptionStatus();
  }, [board, statusQueryString]);

  function handleOpenDialog() {
    setErrorMessage('');
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    if (isProcessing) {
      return;
    }

    setIsDialogOpen(false);
  }

  async function handleStartSubscription() {
    try {
      setErrorMessage('');
      setIsProcessing(true);

      const response = await fetch('/api/payments/toss/subscriptions/start', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteName,
          boardName,
          targetType,
          seriesName: selectedSeries?.series_key ?? null,
          successUrl: `/${siteName}/${boardName}/subscription/success`,
          failUrl: `/${siteName}/${boardName}/subscription/fail`,
        }),
      });

      const result = (await response.json()) as SubscriptionStartResponse;

      if (!response.ok) {
        throw new Error('error' in result ? result.error : '구독을 시작하지 못했습니다.');
      }

      if ('error' in result) {
        throw new Error(result.error || '구독을 시작하지 못했습니다.');
      }

      if (result.mode === 'direct_billing') {
        setSubscriptionStatus('active');
        setIsDialogOpen(false);
        return;
      }

      if (!result.clientKey || !result.customerKey || !result.successUrl || !result.failUrl) {
        throw new Error('구독 결제 정보가 올바르지 않습니다.');
      }

      const tossPayments = await loadTossPayments(result.clientKey);

      await tossPayments.requestBillingAuth('카드', {
        customerKey: result.customerKey,
        successUrl: result.successUrl,
        failUrl: result.failUrl,
      });
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '구독을 시작하지 못했습니다.');
      } else {
        setErrorMessage('구독을 시작하지 못했습니다.');
      }
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleCancelSubscription() {
    try {
      setErrorMessage('');
      setIsProcessing(true);

      const response = await fetch('/api/payments/toss/subscriptions/cancel', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteName,
          boardName,
          targetType,
          seriesName: selectedSeries?.series_key ?? null,
        }),
      });

      const result = (await response.json()) as SubscriptionActionResponse;

      if (!response.ok) {
        throw new Error('error' in result ? result.error : '구독을 취소하지 못했습니다.');
      }

      if ('error' in result) {
        throw new Error(result.error || '구독을 취소하지 못했습니다.');
      }

      if (result.mode === 'cancel_scheduled') {
        setSubscriptionStatus('scheduled_cancel');
      } else {
        setSubscriptionStatus('canceled');
      }
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '구독을 취소하지 못했습니다.');
      } else {
        setErrorMessage('구독을 취소하지 못했습니다.');
      }
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleResumeSubscription() {
    try {
      setErrorMessage('');
      setIsProcessing(true);

      const response = await fetch('/api/payments/toss/subscriptions/resume', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteName,
          boardName,
          targetType,
          seriesName: selectedSeries?.series_key ?? null,
        }),
      });

      const result = (await response.json()) as SubscriptionActionResponse;

      if (!response.ok) {
        throw new Error('error' in result ? result.error : '구독 취소를 철회하지 못했습니다.');
      }

      if ('error' in result) {
        throw new Error(result.error || '구독 취소를 철회하지 못했습니다.');
      }

      setSubscriptionStatus('active');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '구독 취소를 철회하지 못했습니다.');
      } else {
        setErrorMessage('구독 취소를 철회하지 못했습니다.');
      }
    } finally {
      setIsProcessing(false);
    }
  }

  if (!isEnabled) {
    return null;
  }

  return (
    <>
      <Stack spacing={1} alignItems="flex-start">
        {subscriptionStatus === 'none' || subscriptionStatus === 'canceled' || subscriptionStatus === 'expired' ? (
          <Button type="button" variant="contained" onClick={handleOpenDialog} disabled={isProcessing}>
            {getSubscribeButtonText({ targetType, subscriptionStatus })}
          </Button>
        ) : null}

        {subscriptionStatus === 'active' || subscriptionStatus === 'past_due' ? (
          <Button type="button" variant="outlined" onClick={handleCancelSubscription} disabled={isProcessing}>
            {targetType === 'series' ? '연재 구독 취소' : '게시판 구독 취소'}
          </Button>
        ) : null}

        {subscriptionStatus === 'scheduled_cancel' ? (
          <Button type="button" variant="contained" onClick={handleResumeSubscription} disabled={isProcessing}>
            재구독하기
          </Button>
        ) : null}

        {errorMessage ? (
          <Typography color="error" role="alert">
            {errorMessage}
          </Typography>
        ) : null}
      </Stack>

      <Dialog open={isDialogOpen} onClose={handleCloseDialog} aria-labelledby="subscription-dialog-title">
        <DialogTitle id="subscription-dialog-title">{getDialogTitle({ targetType, subscriptionStatus })}</DialogTitle>
        <DialogContent>
          <Typography>
            {targetLabel}을 월 {formatPrice(price ?? 0)}원에 구독합니다.
          </Typography>
          {errorMessage ? (
            <Typography color="error" role="alert">
              {errorMessage}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={handleCloseDialog} disabled={isProcessing}>
            취소
          </Button>
          <Button type="button" variant="contained" onClick={handleStartSubscription} disabled={isProcessing}>
            {getDialogSubmitText(subscriptionStatus)}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
