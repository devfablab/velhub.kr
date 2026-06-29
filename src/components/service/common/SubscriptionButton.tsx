'use client';

import { useEffect, useMemo, useState } from 'react';
import * as PortOne from '@portone/browser-sdk/v2';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Snackbar,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import LoyaltyOutlinedIcon from '@mui/icons-material/LoyaltyOutlined';
import CreditCardOffOutlinedIcon from '@mui/icons-material/CreditCardOffOutlined';
import styles from '@/app/board.module.sass';

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
export type SubscriptionStatus = 'none' | 'active' | 'scheduled_cancel' | 'canceled' | 'expired' | 'past_due';

type Props = {
  siteName: string;
  boardName: string;
  board: BoardInfo | null;
  selectedSeries: SelectedSeries | null;
  selectedBoard?: boolean | null;
  ownerUserId: string;
  onStatusChange?: (subscriptionStatus: SubscriptionStatus) => void;
};

type SubscriptionStatusResponse = {
  isEnabled?: boolean;
  price?: number | null;
  subscriptionStatus?: SubscriptionStatus;
  isRefundableCancellation?: boolean;
  error?: string;
};

type PortOneBillingKeyResponse = {
  billingKey?: string;
  code?: string;
  message?: string;
};

type SubscriptionStartResponse =
  | {
      mode: 'billing_auth';
      storeId: string;
      channelKey: string;
      customerKey: string;
      customerName: string;
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

type IdentityStatusResponse = {
  exists: boolean;
  identity: {
    birth_date: string;
  } | null;
  error?: string;
};

function onlyDigits(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '');
}

function isAdult(birthDate: string | null | undefined) {
  const digits = onlyDigits(birthDate);

  if (digits.length !== 8) {
    return false;
  }

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const today = new Date();
  const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
  let age = today.getFullYear() - year;

  if (today < birthdayThisYear) {
    age -= 1;
  }

  return age >= 19;
}

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

function getCancelDialogTitle(targetType: SubscriptionTargetType) {
  return targetType === 'series' ? '연재 구독 취소' : '게시판 구독 취소';
}

function getCancelDialogDescription(isRefundableCancellation: boolean) {
  if (isRefundableCancellation) {
    return '취소시 환불과 동시에 구독이 종료됩니다.';
  }

  return '취소시 이번 이용 기간 종료 후, 다음 결제부터는 추가 결제되지 않습니다.';
}

export default function SubscriptionButton({
  siteName,
  boardName,
  board,
  selectedSeries,
  selectedBoard,
  ownerUserId,
  onStatusChange,
}: Props) {
  const [canShowDonationButton, setCanShowDonationButton] = useState(false);

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
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefundableCancellation, setIsRefundableCancellation] = useState(false);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  useEffect(() => {
    let ignore = false;

    async function checkOwnerAge() {
      try {
        const response = await fetch(`/api/identity/portone/status?userId=${ownerUserId}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as IdentityStatusResponse;

        if (!ignore) {
          setCanShowDonationButton(Boolean(response.ok && result.identity && isAdult(result.identity.birth_date)));
        }
      } catch {
        if (!ignore) {
          setCanShowDonationButton(false);
        }
      }
    }

    void checkOwnerAge();

    return () => {
      ignore = true;
    };
  }, [ownerUserId]);

  useEffect(() => {
    async function loadSubscriptionStatus() {
      try {
        setIsEnabled(false);
        setPrice(null);
        setSubscriptionStatus('none');
        setIsRefundableCancellation(false);
        onStatusChange?.('none');

        if (!board) {
          return;
        }

        const response = await fetch(`/api/payments/portone/subscriptions/status?${statusQueryString}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as SubscriptionStatusResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '구독 상태를 확인하지 못했습니다.');
        }

        const nextSubscriptionStatus = result.subscriptionStatus ?? 'none';

        setIsEnabled(Boolean(result.isEnabled));
        setPrice(result.price ?? null);
        setSubscriptionStatus(nextSubscriptionStatus);
        setIsRefundableCancellation(Boolean(result.isRefundableCancellation));
        onStatusChange?.(nextSubscriptionStatus);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '구독 상태를 확인하지 못했습니다.');
        } else {
          setErrorMessage('구독 상태를 확인하지 못했습니다.');
        }
      }
    }

    void loadSubscriptionStatus();
  }, [board, statusQueryString, onStatusChange]);

  if (!canShowDonationButton) {
    return null;
  }

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

  function handleOpenCancelDialog() {
    setErrorMessage('');
    setIsCancelDialogOpen(true);
  }

  function handleCloseCancelDialog() {
    if (isProcessing) {
      return;
    }

    setIsCancelDialogOpen(false);
  }

  async function handleStartSubscription() {
    try {
      setErrorMessage('');
      setIsProcessing(true);

      const response = await fetch('/api/payments/portone/subscriptions/start', {
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
        onStatusChange?.('active');
        setIsDialogOpen(false);
        return;
      }

      if (
        !result.storeId ||
        !result.channelKey ||
        !result.customerKey ||
        !result.customerName ||
        !result.orderNo ||
        !result.orderName ||
        !result.successUrl
      ) {
        throw new Error('구독 결제 정보가 올바르지 않습니다.');
      }

      const billingKeyResponse = (await PortOne.requestIssueBillingKey({
        storeId: result.storeId,
        channelKey: result.channelKey,
        billingKeyMethod: 'CARD',
        issueId: result.orderNo,
        issueName: result.orderName,
        displayAmount: result.amount,
        currency: 'KRW',
        customer: {
          customerId: result.customerKey,
          fullName: result.customerName,
          email: result.customerName,
        },
        redirectUrl: result.successUrl,
      })) as PortOneBillingKeyResponse | undefined;

      if (!billingKeyResponse) {
        throw new Error('구독 결제수단 등록 응답이 없습니다.');
      }

      if (billingKeyResponse.code) {
        throw new Error(billingKeyResponse.message || '구독 결제수단 등록에 실패했습니다.');
      }

      if (!billingKeyResponse.billingKey) {
        throw new Error('billingKey가 발급되지 않았습니다.');
      }

      const successResponse = await fetch('/api/payments/portone/subscriptions/success', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          billingKey: billingKeyResponse.billingKey,
          customerKey: result.customerKey,
          orderNo: result.orderNo,
          siteName,
          boardName,
          targetType,
          seriesName: selectedSeries?.series_key ?? null,
        }),
      });

      const successResult = (await successResponse.json()) as SubscriptionActionResponse;

      if (!successResponse.ok) {
        throw new Error('error' in successResult ? successResult.error : '구독을 완료하지 못했습니다.');
      }

      setSubscriptionStatus('active');
      onStatusChange?.('active');
      setIsDialogOpen(false);
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

      const response = await fetch('/api/payments/portone/subscriptions/cancel', {
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
        onStatusChange?.('scheduled_cancel');
      } else {
        setSubscriptionStatus('canceled');
        onStatusChange?.('canceled');
      }

      setIsCancelDialogOpen(false);
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

      const response = await fetch('/api/payments/portone/subscriptions/resume', {
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
      onStatusChange?.('active');
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
      {subscriptionStatus === 'none' || subscriptionStatus === 'canceled' || subscriptionStatus === 'expired' ? (
        <button
          type="button"
          className={selectedBoard ? 'button small action' : styles.button}
          onClick={handleOpenDialog}
          disabled={isProcessing}
        >
          {selectedBoard ? null : <LoyaltyOutlinedIcon />}
          <strong>{getSubscribeButtonText({ targetType, subscriptionStatus })}</strong>
        </button>
      ) : null}

      {subscriptionStatus === 'active' || subscriptionStatus === 'past_due' ? (
        <button
          type="button"
          className={selectedBoard ? 'button small action' : styles.button}
          onClick={handleOpenCancelDialog}
          disabled={isProcessing}
        >
          {selectedBoard ? null : <CreditCardOffOutlinedIcon />}
          <strong>{targetType === 'series' ? '연재 구독 취소' : '게시판 구독 취소'}</strong>
        </button>
      ) : null}

      {subscriptionStatus === 'scheduled_cancel' ? (
        <button
          type="button"
          className={selectedBoard ? 'button small action' : styles.button}
          onClick={handleResumeSubscription}
          disabled={isProcessing}
        >
          {selectedBoard ? null : <CreditCardOffOutlinedIcon />}
          <strong>재구독하기</strong>
        </button>
      ) : null}

      {errorMessage ? (
        <Snackbar
          open={Boolean(errorMessage)}
          message={errorMessage}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'center',
          }}
          autoHideDuration={2700}
          onClose={() => setErrorMessage('')}
        />
      ) : null}

      {isMobile ? (
        <Drawer anchor="bottom" open={isDialogOpen} onClose={handleCloseDialog} className="VhiDrawer-bottom">
          <h2>{getDialogTitle({ targetType, subscriptionStatus })}</h2>
          <button type="button" className="close-button" onClick={handleCloseDialog} disabled={isProcessing}>
            <CloseRoundedIcon />
          </button>
          <Stack gap={3}>
            <Typography variant="body2">
              {targetLabel}을 월 {formatPrice(price ?? 0)}원에 구독하시겠어요?
            </Typography>
            {errorMessage ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{errorMessage}</span>
              </p>
            ) : null}
            <Stack direction="column" spacing={1.5}>
              <button
                type="button"
                className="button medium cancel"
                onClick={handleCloseDialog}
                disabled={isProcessing}
              >
                취소
              </button>
              <button
                type="button"
                className="button medium submit"
                onClick={handleStartSubscription}
                disabled={isProcessing}
              >
                {getDialogSubmitText(subscriptionStatus)}
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog
          open={isDialogOpen}
          onClose={handleCloseDialog}
          aria-labelledby="subscription-dialog-title"
          className="VhiDialog"
        >
          <DialogTitle id="subscription-dialog-title">{getDialogTitle({ targetType, subscriptionStatus })}</DialogTitle>
          <button type="button" className="close-button" onClick={handleCloseDialog} disabled={isProcessing}>
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <Typography variant="body2">
              {targetLabel}을 월 {formatPrice(price ?? 0)}원에 구독하시겠어요?
            </Typography>
            {errorMessage ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{errorMessage}</span>
              </p>
            ) : null}
          </DialogContent>
          <DialogActions>
            <button type="button" className="button medium close" onClick={handleCloseDialog} disabled={isProcessing}>
              취소
            </button>
            <button
              type="button"
              className="button medium submit"
              onClick={handleStartSubscription}
              disabled={isProcessing}
            >
              {getDialogSubmitText(subscriptionStatus)}
            </button>
          </DialogActions>
        </Dialog>
      )}

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isCancelDialogOpen}
          onClose={handleCloseCancelDialog}
          className="VhiDrawer-bottom"
        >
          <h2>{getCancelDialogTitle(targetType)}</h2>
          <button type="button" className="close-button" onClick={handleCloseCancelDialog} disabled={isProcessing}>
            <CloseRoundedIcon />
          </button>
          <Stack gap={3}>
            <Stack>
              <Typography variant="subtitle2">{targetLabel} 구독을 취소하시겠어요?</Typography>
              <Typography variant="body2">{getCancelDialogDescription(isRefundableCancellation)}</Typography>
              {errorMessage ? (
                <p className="alert error">
                  <ErrorOutlineRoundedIcon />
                  <span>{errorMessage}</span>
                </p>
              ) : null}
            </Stack>
            <Stack direction="column" spacing={1.5}>
              <button
                type="button"
                className="button medium cancel"
                onClick={handleCloseCancelDialog}
                disabled={isProcessing}
              >
                아니요
              </button>
              <button
                type="button"
                className="button medium submit"
                onClick={handleCancelSubscription}
                disabled={isProcessing}
              >
                구독 취소
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog
          open={isCancelDialogOpen}
          onClose={handleCloseCancelDialog}
          aria-labelledby="subscription-cancel-dialog-title"
          className="VhiDialog"
        >
          <DialogTitle id="subscription-cancel-dialog-title">{getCancelDialogTitle(targetType)}</DialogTitle>
          <button type="button" className="close-button" onClick={handleCloseCancelDialog} disabled={isProcessing}>
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <Stack>
              <Typography variant="subtitle2">{targetLabel} 구독을 취소하시겠어요?</Typography>
              <Typography variant="body2">{getCancelDialogDescription(isRefundableCancellation)}</Typography>
              {errorMessage ? (
                <p className="alert error">
                  <ErrorOutlineRoundedIcon />
                  <span>{errorMessage}</span>
                </p>
              ) : null}
            </Stack>
          </DialogContent>
          <DialogActions>
            <button
              type="button"
              className="button medium close"
              onClick={handleCloseCancelDialog}
              disabled={isProcessing}
            >
              아니요
            </button>
            <button
              type="button"
              className="button medium submit"
              onClick={handleCancelSubscription}
              disabled={isProcessing}
            >
              구독 취소
            </button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
