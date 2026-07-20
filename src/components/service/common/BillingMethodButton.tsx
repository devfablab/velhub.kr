'use client';

import { useState } from 'react';
import * as PortOne from '@portone/browser-sdk/v2';
import { Snackbar } from '@mui/material';
import { normalizeText } from '@/lib/utils';

type PortOneBillingKeyResponse = {
  billingKey?: string;
  code?: string;
  message?: string;
};

type BillingMethodStatusResponse = {
  paymentEmail: string | null;
  error?: string;
};

type BillingMethodStartResponse =
  | {
      customerName: string | undefined;
      storeId: string;
      channelKey: string;
      customerKey: string;
      orderNo: string;
      orderName: string;
      successUrl: string;
      failUrl: string;
    }
  | { error: string };

type BillingMethodButtonProps = {
  siteId?: string | null;
};

export default function BillingMethodButton({ siteId }: BillingMethodButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function getBillingMethodStatus() {
    const response = await fetch('/api/payments/portone/billing-method/status', {
      method: 'GET',
      credentials: 'include',
    });

    const result = (await response.json()) as BillingMethodStatusResponse;

    if (!response.ok) {
      throw new Error(result.error || '결제 이메일을 확인하지 못했습니다.');
    }

    return normalizeText(result.paymentEmail);
  }

  async function startBillingMethodIssue(paymentEmail: string) {
    const response = await fetch('/api/payments/portone/billing-method/start', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderName: '데브허브 결제 수단 추가',
        successUrl: `${window.location.origin}/hub/purchase/success`,
        failUrl: `${window.location.origin}/hub/purchase/fail`,
      }),
    });

    const result = (await response.json()) as BillingMethodStartResponse;

    if (!response.ok || 'error' in result) {
      throw new Error('error' in result ? result.error : '결제 수단 추가를 시작하지 못했습니다.');
    }

    if (
      !result.storeId ||
      !result.channelKey ||
      !result.customerKey ||
      !result.orderNo ||
      !result.orderName ||
      !result.successUrl
    ) {
      throw new Error('결제 수단 추가 정보가 올바르지 않습니다.');
    }

    const billingKeyResponse = (await PortOne.requestIssueBillingKey({
      storeId: result.storeId,
      channelKey: result.channelKey,
      billingKeyMethod: 'CARD',
      issueId: result.orderNo,
      issueName: result.orderName,
      customer: {
        customerId: result.customerKey,
        fullName: result.customerName,
        email: paymentEmail,
      },
      redirectUrl: result.successUrl,
    })) as PortOneBillingKeyResponse | undefined;

    if (!billingKeyResponse) {
      throw new Error('결제 수단 추가 응답이 없습니다.');
    }

    if (billingKeyResponse.code) {
      throw new Error(billingKeyResponse.message || '결제 수단 추가에 실패했습니다.');
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
        siteId: normalizeText(siteId) || undefined,
      }),
    });

    const successResult = (await successResponse.json()) as { error?: string };

    if (!successResponse.ok) {
      throw new Error(successResult.error ?? '결제 수단을 추가하지 못했습니다.');
    }

    window.location.reload();
  }

  async function handleAddBillingMethod() {
    try {
      setIsProcessing(true);
      setErrorMessage('');

      const paymentEmail = await getBillingMethodStatus();

      if (!paymentEmail) {
        throw new Error('정산 이메일이 등록되어 있지 않습니다.');
      }

      await startBillingMethodIssue(paymentEmail);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '결제 수단 추가를 시작하지 못했습니다.');
      } else {
        setErrorMessage('결제 수단 추가를 시작하지 못했습니다.');
      }

      setIsProcessing(false);
    }
  }

  return (
    <>
      <button type="button" className="button small action" onClick={handleAddBillingMethod} disabled={isProcessing}>
        결제 수단 추가
      </button>

      <Snackbar
        open={Boolean(normalizeText(errorMessage))}
        message={errorMessage}
        autoHideDuration={3000}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        onClose={() => setErrorMessage('')}
      />
    </>
  );
}
