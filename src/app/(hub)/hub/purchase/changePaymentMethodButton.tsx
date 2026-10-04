'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import * as PortOne from '@portone/browser-sdk/v2';
import FormErrorDialog from '@/components/FormErrorDialog';
import DuplicateBillingMethodDialog from '@/components/service/common/DuplicateBillingMethodDialog';
import styles from '@/app/hub.module.sass';

type PortOneBillingKeyResponse = {
  billingKey?: string;
  code?: string;
  message?: string;
};

type BillingMethodStartResponse = {
  amount: number | undefined;
  storeId?: string;
  channelKey?: string;
  customerKey?: string;
  customerName?: string;
  customerPhone?: string;
  orderNo?: string;
  orderName?: string;
  successUrl?: string;
  failUrl?: string;
  error?: string;
};

type ErrorDialogState = { title: string | null; message: string };

function getBillingMethodMessage(status: string | null) {
  if (status === 'success') {
    return '결제수단을 변경했습니다.';
  }

  if (status === 'fail') {
    return '결제수단을 변경하지 못했습니다. 카드 정보를 확인한 뒤 다시 시도해 주세요.';
  }

  return '';
}

function getPortOneFailureMessage(code: string | undefined) {
  const normalizedCode = code?.toUpperCase() ?? '';
  if (normalizedCode.includes('CANCEL')) return '결제수단 변경을 취소했습니다.';
  if (normalizedCode.includes('NOT_SUPPORTED') || normalizedCode.includes('UNSUPPORTED')) {
    return '이 카드로는 결제수단을 등록할 수 없습니다. 다른 카드를 사용해 주세요.';
  }
  return '카드 정보를 확인한 뒤 다시 시도해 주세요.';
}

export default function ChangePaymentMethodButton() {
  const searchParams = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorDialog, setErrorDialog] = useState<ErrorDialogState | null>(null);
  const [isDuplicatePaymentMethodDialogOpen, setIsDuplicatePaymentMethodDialogOpen] = useState(false);

  const billingMethodMessage = getBillingMethodMessage(searchParams.get('billingMethod'));

  async function handleChangePaymentMethod() {
    try {
      setIsProcessing(true);
      setErrorDialog(null);

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
        if (response.status === 401) {
          setErrorDialog({ title: '로그인 필요', message: '로그인 후 결제수단을 변경해 주세요.' });
        } else if (response.status === 400 && result.error?.includes('휴대전화')) {
          setErrorDialog({
            title: '본인인증 확인',
            message: '본인인증된 휴대전화 번호를 확인한 뒤 다시 시도해 주세요.',
          });
        } else {
          setErrorDialog({ title: null, message: '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
        }
        return;
      }

      if (
        !result.storeId ||
        !result.channelKey ||
        !result.customerKey ||
        !result.customerName ||
        !result.customerPhone ||
        !result.orderNo ||
        !result.orderName ||
        !result.successUrl
      ) {
        setErrorDialog({
          title: null,
          message: '결제수단 변경 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
        });
        return;
      }

      const billingKeyResponse = (await PortOne.requestIssueBillingKey({
        storeId: result.storeId,
        channelKey: result.channelKey,
        billingKeyMethod: 'CARD',
        issueId: result.orderNo,
        issueName: result.orderName,
        displayAmount: result.amount,
        currency: 'KRW',
        offerPeriod: { interval: '1m' },
        customer: {
          customerId: result.customerKey,
          fullName: result.customerName,
          email: result.customerName,
          phoneNumber: result.customerPhone,
        },
        redirectUrl: result.successUrl,
      })) as PortOneBillingKeyResponse | undefined;

      if (!billingKeyResponse) {
        setErrorDialog({
          title: null,
          message: '결제수단 변경 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        });
        return;
      }

      if (billingKeyResponse.code) {
        setErrorDialog({ title: '결제수단 변경', message: getPortOneFailureMessage(billingKeyResponse.code) });
        return;
      }

      if (!billingKeyResponse.billingKey) {
        setErrorDialog({
          title: null,
          message: '결제수단 변경 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        });
        return;
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

      const successResult = (await successResponse.json()) as { error?: string; duplicatePaymentMethod?: boolean };

      if (!successResponse.ok) {
        if (successResponse.status === 401) {
          setErrorDialog({ title: '로그인 필요', message: '로그인 후 결제수단을 변경해 주세요.' });
        } else if (successResponse.status === 400) {
          setErrorDialog({
            title: '결제수단 확인',
            message: '결제수단 정보를 확인하지 못했습니다. 다시 등록해 주세요.',
          });
        } else {
          setErrorDialog({ title: null, message: '결제수단을 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
        }
        return;
      }

      if (successResult.duplicatePaymentMethod) {
        setIsProcessing(false);
        setIsDuplicatePaymentMethodDialogOpen(true);
        return;
      }

      window.location.href = '/hub/purchase?billingMethod=success';
    } catch {
      setErrorDialog({ title: null, message: '인터넷 연결을 확인한 뒤 다시 시도해 주세요.' });
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className={styles.buttons}>
      <button type="button" className="button small action" onClick={handleChangePaymentMethod} disabled={isProcessing}>
        결제수단 변경
      </button>
      {billingMethodMessage ? <p role="status">{billingMethodMessage}</p> : null}
      <DuplicateBillingMethodDialog
        open={isDuplicatePaymentMethodDialogOpen}
        title="결제수단 변경"
        onClose={() => setIsDuplicatePaymentMethodDialogOpen(false)}
        onConfirm={() => (window.location.href = '/hub/purchase?billingMethod=success')}
      />
      <FormErrorDialog
        open={Boolean(errorDialog)}
        title={errorDialog?.title ?? null}
        messages={errorDialog ? [errorDialog.message] : []}
        onClose={() => setErrorDialog(null)}
      />
    </div>
  );
}
