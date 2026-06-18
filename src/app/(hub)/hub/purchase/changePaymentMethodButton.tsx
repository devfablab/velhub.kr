'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import styles from '@/app/hub.module.sass';

type BillingMethodStartResponse = {
  clientKey?: string;
  customerKey?: string;
  successUrl?: string;
  failUrl?: string;
  error?: string;
};

function getBillingMethodMessage(status: string | null, message: string | null) {
  if (status === 'success') {
    return '결제수단을 변경했습니다.';
  }

  if (status === 'fail') {
    return message || '결제수단을 변경하지 못했습니다.';
  }

  return '';
}

export default function ChangePaymentMethodButton() {
  const searchParams = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const billingMethodMessage = getBillingMethodMessage(searchParams.get('billingMethod'), searchParams.get('message'));

  async function handleChangePaymentMethod() {
    try {
      setIsProcessing(true);
      setErrorMessage('');

      const response = await fetch('/api/hub/purchase/billing-method/start', {
        method: 'POST',
        credentials: 'include',
      });

      const result = (await response.json()) as BillingMethodStartResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '결제수단 변경을 시작하지 못했습니다.');
      }

      if (!result.clientKey || !result.customerKey || !result.successUrl || !result.failUrl) {
        throw new Error('결제수단 변경 정보가 올바르지 않습니다.');
      }

      const tossPayments = await loadTossPayments(result.clientKey);

      await tossPayments.requestBillingAuth('카드', {
        customerKey: result.customerKey,
        successUrl: result.successUrl,
        failUrl: result.failUrl,
      });
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '결제수단 변경을 시작하지 못했습니다.');
      } else {
        setErrorMessage('결제수단 변경을 시작하지 못했습니다.');
      }

      setIsProcessing(false);
    }
  }

  return (
    <div className={styles.buttons}>
      <button type="button" className="button small action" onClick={handleChangePaymentMethod} disabled={isProcessing}>
        결제수단 변경
      </button>
      {errorMessage ? <p role="status">{errorMessage}</p> : null}
      {!errorMessage && billingMethodMessage ? <p role="status">{billingMethodMessage}</p> : null}
    </div>
  );
}
