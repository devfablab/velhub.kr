'use client';

import { useState } from 'react';
import * as PortOne from '@portone/browser-sdk/v2';
import { Chip, Snackbar, Stack, Typography } from '@mui/material';
import { normalizeText } from '@/lib/utils';

type BillingMethod = {
  id: string;
  provider: string;
  cardCompany: string | null;
  cardNumberLabel: string | null;
  ownerType: string | null;
  cardType: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string | null;
};

type PortOneBillingKeyResponse = {
  billingKey?: string;
  code?: string;
  message?: string;
};

type BillingMethodStartResponse =
  | {
      storeId: string;
      channelKey: string;
      customerKey: string;
      orderNo: string;
      orderName: string;
      successUrl: string;
      failUrl: string;
    }
  | {
      error: string;
    };

type BillingMethodsProps = {
  billingMethods: BillingMethod[];
};

function formatCardNumber(cardNumberMasked: string | null | undefined) {
  const normalizedCardNumber = normalizeText(cardNumberMasked).replace(/\D/g, '');

  if (normalizedCardNumber.length < 4) {
    return '카드번호 확인 필요';
  }

  return `${normalizedCardNumber.slice(0, 4)} ••••`;
}

export default function BillingMethods({ billingMethods }: BillingMethodsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleAddBillingMethod() {
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
          orderName: '데브허브 결제 수단 추가',
          successUrl: `${window.location.origin}/hub/purchase/success`,
          failUrl: `${window.location.origin}/hub/purchase/fail`,
        }),
      });

      const result = (await response.json()) as BillingMethodStartResponse;

      if (!response.ok || 'error' in result) {
        throw new Error('error' in result ? result.error : '결제 수단 추가를 시작하지 못했습니다.');
      }

      if (!result.storeId || !result.channelKey || !result.customerKey || !result.orderNo || !result.orderName || !result.successUrl) {
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
        }),
      });

      const successResult = (await successResponse.json()) as { error?: string };

      if (!successResponse.ok) {
        throw new Error(successResult.error ?? '결제 수단을 추가하지 못했습니다.');
      }

      window.location.reload();
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
      {billingMethods.length ? (
        <Stack gap={1}>
          {billingMethods.map((billingMethod) => (
            <div className="paper" key={billingMethod.id}>
              <Stack gap={0.5} direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="body2">
                  {billingMethod.cardCompany ?? '카드'} {formatCardNumber(billingMethod.cardNumberLabel)}
                </Typography>
                {billingMethod.isDefault ? <Chip label="기본" size="small" className="chip success" /> : null}
              </Stack>
            </div>
          ))}
        </Stack>
      ) : (
        <Typography>등록된 결제 수단이 없습니다.</Typography>
      )}

      <div>
        <button type="button" className="button small action" onClick={handleAddBillingMethod} disabled={isProcessing}>
          결제 수단 추가하기
        </button>
      </div>

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
