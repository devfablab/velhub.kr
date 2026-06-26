'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import * as PortOne from '@portone/browser-sdk/v2';
import styles from '@/app/hub.module.sass';

type PortOneBillingKeyResponse = {
  billingKey?: string;
  code?: string;
  message?: string;
};

type BillingMethodStartResponse = {
  storeId?: string;
  channelKey?: string;
  customerKey?: string;
  orderNo?: string;
  orderName?: string;
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

      const response = await fetch('/api/payments/portone/billing-method/start', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderName: '데브허브 결제 수단 변경',
          successUrl: `${window.location.origin}/hub/purchase/success`,
          failUrl: `${window.location.origin}/hub/purchase/fail`,
        }),
      });

      const result = (await response.json()) as BillingMethodStartResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '결제수단 변경을 시작하지 못했습니다.');
      }

      if (!result.storeId || !result.channelKey || !result.customerKey || !result.orderNo || !result.orderName || !result.successUrl) {
        throw new Error('결제수단 변경 정보가 올바르지 않습니다.');
      }

      const billingKeyResponse = (await PortOne.requestIssueBillingKey({
        storeId: result.storeId,
        channelKey: result.channelKey,
        billingKeyMethod: 'CARD',
        issueId: result.orderNo,
        issueName: result.orderName,
        customer: {
          customerId: result.customerKey,
        },
        redirectUrl: result.successUrl,
      })) as PortOneBillingKeyResponse | undefined;

      if (!billingKeyResponse) {
        throw new Error('결제수단 변경 응답이 없습니다.');
      }

      if (billingKeyResponse.code) {
        throw new Error(billingKeyResponse.message || '결제수단 변경에 실패했습니다.');
      }

      if (!billingKeyResponse.billingKey) {
        throw new Error('billingKey가 발급되지 않았습니다.');
      }

      const successResponse = await fetch('/api/payments/portone/billing-method/success', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          billingKey: billingKeyResponse.billingKey,
          customerKey: result.customerKey,
          orderNo: result.orderNo,
        }),
      });

      const successResult = (await successResponse.json()) as { error?: string };

      if (!successResponse.ok) {
        throw new Error(successResult.error ?? '결제수단을 변경하지 못했습니다.');
      }

      window.location.href = '/hub/purchase?billingMethod=success';
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
