'use client';

import { useState } from 'react';
import { Snackbar } from '@mui/material';
import * as PortOne from '@portone/browser-sdk/v2';
import { normalizeText } from '@/lib/utils';
import DuplicateBillingMethodDialog from './DuplicateBillingMethodDialog';
import PaymentEmailDialog from './PaymentEmailDialog';

type PortOneBillingKeyResponse = {
  billingKey?: string;
  code?: string;
  message?: string;
};

type BillingMethodStatusResponse = {
  paymentEmail: string | null;
  paymentPhone: string | null;
  error?: string;
};

type BillingMethodStartResponse =
  | {
      customerName: string | undefined;
      customerPhone: string;
      storeId: string;
      channelKey: string;
      customerKey: string;
      orderNo: string;
      orderName: string;
      successUrl: string;
      failUrl: string;
    }
  | { error: string; paymentEmailRequired?: boolean }
  | { paymentEmailRequired: true };

type BillingMethodButtonProps = {
  siteId?: string | null;
};

export default function BillingMethodButton({ siteId }: BillingMethodButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPaymentEmailDialogOpen, setIsPaymentEmailDialogOpen] = useState(false);
  const [needsPaymentEmail, setNeedsPaymentEmail] = useState(true);
  const [needsPaymentPhone, setNeedsPaymentPhone] = useState(false);
  const [isDuplicatePaymentMethodDialogOpen, setIsDuplicatePaymentMethodDialogOpen] = useState(false);

  async function getBillingMethodStatus() {
    const response = await fetch('/api/payments/portone/billing-method/status', {
      method: 'GET',
      credentials: 'include',
    });

    const result = (await response.json()) as BillingMethodStatusResponse;

    if (!response.ok) {
      throw new Error(result.error || '결제 이메일을 확인하지 못했습니다.');
    }

    return {
      paymentEmail: normalizeText(result.paymentEmail),
      paymentPhone: normalizeText(result.paymentPhone),
    };
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

    if ('paymentEmailRequired' in result && result.paymentEmailRequired) {
      setIsProcessing(false);
      setIsPaymentEmailDialogOpen(true);
      return;
    }

    if (!response.ok || 'error' in result) {
      throw new Error('error' in result ? result.error : '결제 수단 추가를 시작하지 못했습니다.');
    }

    if (
      !result.storeId ||
      !result.channelKey ||
      !result.customerKey ||
      !result.customerPhone ||
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
      offerPeriod: { interval: '1m' },
      customer: {
        customerId: result.customerKey,
        fullName: result.customerName,
        email: paymentEmail,
        phoneNumber: result.customerPhone,
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

    const successResult = (await successResponse.json()) as { error?: string; duplicatePaymentMethod?: boolean };

    if (!successResponse.ok) {
      throw new Error(successResult.error ?? '결제 수단을 추가하지 못했습니다.');
    }

    if (successResult.duplicatePaymentMethod) {
      setIsProcessing(false);
      setIsDuplicatePaymentMethodDialogOpen(true);
      return;
    }

    window.location.reload();
  }

  async function handleAddBillingMethod() {
    try {
      setIsProcessing(true);
      setErrorMessage('');

      const { paymentEmail, paymentPhone } = await getBillingMethodStatus();

      if (!paymentEmail || !paymentPhone) {
        setIsProcessing(false);
        setNeedsPaymentEmail(!paymentEmail);
        setNeedsPaymentPhone(!paymentPhone);
        setIsPaymentEmailDialogOpen(true);
        return;
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

  async function handlePaymentEmailSaved(paymentEmail: string) {
    try {
      setIsProcessing(true);
      setErrorMessage('');
      await startBillingMethodIssue(paymentEmail);
    } catch (unknownError) {
      setErrorMessage(
        unknownError instanceof Error
          ? unknownError.message || '결제 수단 추가를 시작하지 못했습니다.'
          : '결제 수단 추가를 시작하지 못했습니다.',
      );
      setIsProcessing(false);
    }
  }

  return (
    <>
      <button type="button" className="button small action" onClick={handleAddBillingMethod} disabled={isProcessing}>
        결제 수단 추가
      </button>

      <PaymentEmailDialog
        open={isPaymentEmailDialogOpen}
        onClose={() => setIsPaymentEmailDialogOpen(false)}
        requireEmail={needsPaymentEmail}
        requirePhone={needsPaymentPhone}
        onSaved={handlePaymentEmailSaved}
      />

      <DuplicateBillingMethodDialog
        open={isDuplicatePaymentMethodDialogOpen}
        title="결제수단 추가"
        onClose={() => setIsDuplicatePaymentMethodDialogOpen(false)}
        onConfirm={() => window.location.reload()}
      />

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
