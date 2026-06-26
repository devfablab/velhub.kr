'use client';

import { useState } from 'react';
import * as PortOne from '@portone/browser-sdk/v2';
import { Chip, Snackbar, Stack, Typography } from '@mui/material';
import { normalizeText } from '@/lib/utils';
import { BillingMethod } from './page';

type PortOneBillingKeyResponse = {
  billingKey?: string;
  code?: string;
  message?: string;
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

function getCardCompanyText(cardCompany: string | null | undefined) {
  const normalizedCardCompany = normalizeText(cardCompany);

  const cardCompanyTextMap: Record<string, string> = {
    HYUNDAI_CARD: '현대카드',
    SHINHAN_CARD: '신한카드',
    SAMSUNG_CARD: '삼성카드',
    KB_CARD: '국민카드',
    KOOKMIN_CARD: '국민카드',
    LOTTE_CARD: '롯데카드',
    HANA_CARD: '하나카드',
    WOORI_CARD: '우리카드',
    BC_CARD: 'BC카드',
    NH_CARD: 'NH농협카드',
    NONGHYUP_CARD: 'NH농협카드',
    CITI_CARD: '씨티카드',
    KAKAOBANK_CARD: '카카오뱅크카드',
    K_BANK_CARD: '케이뱅크카드',
    TOSSBANK_CARD: '토스뱅크카드',
  };

  return (cardCompanyTextMap[normalizedCardCompany] ?? normalizedCardCompany) || '카드';
}

function getCardTypeText(cardType: string | null | undefined) {
  const normalizedCardType = normalizeText(cardType);

  const cardTypeTextMap: Record<string, string> = {
    CREDIT: '신용카드',
    DEBIT: '체크카드',
    GIFT: '기프트카드',
  };

  return (cardTypeTextMap[normalizedCardType] ?? normalizedCardType) || '카드 유형 확인 필요';
}

function getOwnerTypeText(ownerType: string | null | undefined) {
  const normalizedOwnerType = normalizeText(ownerType);

  const ownerTypeTextMap: Record<string, string> = {
    PERSONAL: '개인카드',
    CORPORATE: '법인카드',
  };

  return (ownerTypeTextMap[normalizedOwnerType] ?? normalizedOwnerType) || '소유 유형 확인 필요';
}

export default function BillingMethods({ billingMethods }: BillingMethodsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  console.log('billingMethods: ', billingMethods);

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
          email: result.customerName,
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
                  {getCardCompanyText(billingMethod.cardCompany)} ({getCardTypeText(billingMethod.cardType)} /{' '}
                  {getOwnerTypeText(billingMethod.ownerType)}) {formatCardNumber(billingMethod.cardNumberLabel)}
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
