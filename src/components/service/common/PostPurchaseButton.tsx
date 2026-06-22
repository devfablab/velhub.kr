'use client';

import { useState } from 'react';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import { Snackbar } from '@mui/material';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import styles from '@/app/board.module.sass';

type PostPurchaseStartResponse = {
  ok?: boolean;
  alreadyPurchased?: boolean;
  paymentId?: string;
  clientKey?: string;
  orderNo?: string;
  orderName?: string;
  amount?: number;
  successUrl?: string;
  failUrl?: string;
  error?: string;
};

type Props = {
  siteName: string;
  boardName: string;
  contentId: string;
  buttonText?: string;
  popup?: boolean;
  disabled?: boolean;
  successUrl?: string;
  failUrl?: string;
  onProcessingChange?: (isProcessing: boolean) => void;
};

function getSuccessUrl({ siteName, boardName, contentId, successUrl }: Props) {
  if (successUrl) {
    return successUrl;
  }

  return `/${siteName}/${boardName}/${contentId}/purchase/success`;
}

function getFailUrl({ siteName, boardName, contentId, failUrl }: Props) {
  if (failUrl) {
    return failUrl;
  }

  return `/${siteName}/${boardName}/${contentId}/purchase/fail`;
}

export default function PostPurchaseButton(props: Props) {
  const { siteName, boardName, contentId, popup, disabled = false, onProcessingChange } = props;

  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  function updateProcessing(nextIsProcessing: boolean) {
    setIsProcessing(nextIsProcessing);
    onProcessingChange?.(nextIsProcessing);
  }

  async function handlePurchase() {
    try {
      setErrorMessage('');
      updateProcessing(true);

      const response = await fetch('/api/payments/toss/purchase/start', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteName,
          boardName,
          contentId,
          successUrl: getSuccessUrl(props),
          failUrl: getFailUrl(props),
        }),
      });

      const result = (await response.json()) as PostPurchaseStartResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '포스팅 구매를 시작하지 못했습니다.');
      }

      if (result.alreadyPurchased) {
        window.location.reload();
        return;
      }

      if (
        !result.clientKey ||
        !result.orderNo ||
        !result.orderName ||
        !result.amount ||
        !result.successUrl ||
        !result.failUrl
      ) {
        throw new Error('포스팅 구매 결제 정보가 올바르지 않습니다.');
      }

      const tossPayments = await loadTossPayments(result.clientKey);

      await tossPayments.requestPayment('카드', {
        amount: result.amount,
        orderId: result.orderNo,
        orderName: result.orderName,
        successUrl: result.successUrl,
        failUrl: result.failUrl,
      });
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '포스팅 구매를 시작하지 못했습니다.');
      } else {
        setErrorMessage('포스팅 구매를 시작하지 못했습니다.');
      }

      updateProcessing(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={popup ? 'button medium submit' : styles.button}
        onClick={handlePurchase}
        disabled={disabled || isProcessing}
      >
        {popup ? null : <SellOutlinedIcon />}
        <strong>포스팅 소장</strong>
      </button>

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
    </>
  );
}
