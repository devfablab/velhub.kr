'use client';

import { Chip, Stack, Typography } from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { normalizeText } from '@/lib/utils';
import { BillingMethod } from './page';
import BillingMethodButton from '@/components/service/common/BillingMethodButton';

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
        <p className="alert warning">
          <WarningAmberRoundedIcon />
          <span>등록된 결제 수단이 없습니다.</span>
        </p>
      )}

      <div>
        <BillingMethodButton />
      </div>
    </>
  );
}
