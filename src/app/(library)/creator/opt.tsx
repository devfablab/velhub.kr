'use client';

import { useEffect, useState } from 'react';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import { Stack, Typography } from '@mui/material';
import { BANK_OPTIONS, BUSINESS_INCOME_CODE_OPTIONS } from '@/lib/settlement/options';
import Anchor from '@/components/Anchor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import IdentityVerificationButton from '@/components/service/common/IdentityVerificationButton';
import SettlementForm from '@/components/service/common/SettlementForm';
import { ThemeMode, useThemeMode } from '@/app/themeProvider';
import styles from '@/app/new.module.sass';

type SettlementType = 'individual' | 'individual_business' | 'corporation' | 'business';

type Identity = {
  name: string;
  birth_date: string;
  gender: string;
  identity_verified_at: string;
};

type Settlement = {
  settlement_type: SettlementType;
  company_name: string | null;
  resident_registration_number: string | null;
  business_registration_number: string | null;
  business_license: string | null;
  business_income_code: string | null;
  bank_code: string | null;
  account_number: string | null;
  account_holder: string | null;
  account_verified_at: string | null;
  status: string | null;
};

type SettlementResponse = {
  exists: boolean;
  identity: Identity | null;
  settlement: Settlement | null;
  paymentEmail: string | null;
};

const THEME_MODE_STORAGE_KEY = 'velhub-theme-mode';

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'system' || value === 'dark';
}

function getStoredThemeMode() {
  if (typeof window === 'undefined') {
    return 'system' as ThemeMode;
  }

  const storedThemeMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);

  if (isThemeMode(storedThemeMode)) {
    return storedThemeMode;
  }

  return 'system' as ThemeMode;
}

function getResolvedThemeMode(themeMode: ThemeMode) {
  if (themeMode === 'light' || themeMode === 'dark') {
    return themeMode;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeMode(themeMode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', `yellow-${getResolvedThemeMode(themeMode)}`);
}

function getSettlementTypeLabel(value: SettlementType) {
  if (value === 'individual') {
    return '개인';
  }

  if (value === 'corporation') {
    return '법인';
  }

  return '개인사업자';
}

function getBankLabel(code: string | null) {
  return BANK_OPTIONS.find((option) => option.code === code)?.label ?? '-';
}

function getBusinessIncomeCodeLabel(code: string | null) {
  if (!code) {
    return '-';
  }

  const option = BUSINESS_INCOME_CODE_OPTIONS.find((item) => item.code === code);

  return option ? `${option.code} (${option.label})` : code;
}

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : '요청 처리에 실패했습니다.';
}

function isMessageResponse(value: unknown): value is { message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

function isUnder14(birthDate: string | null | undefined) {
  if (!birthDate) {
    return false;
  }

  const digits = birthDate.replace(/\D/g, '');
  if (digits.length !== 8) {
    return false;
  }

  const year = parseInt(digits.substring(0, 4), 10);
  const month = parseInt(digits.substring(4, 6), 10);
  const day = parseInt(digits.substring(6, 8), 10);

  const today = new Date();
  const birth = new Date(year, month - 1, day);

  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age < 14;
}

async function getSettlement() {
  const response = await fetch('/api/settlement', { credentials: 'include', cache: 'no-store' });
  const data = (await response.json().catch(() => null)) as SettlementResponse | { message?: string } | null;

  if (!response.ok) {
    throw new Error(isMessageResponse(data) ? data.message : '정산 정보를 불러오지 못했습니다.');
  }

  return data as SettlementResponse;
}

export default function Opt() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [paymentEmail, setPaymentEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { themeMode, setThemeMode } = useThemeMode();

  const load = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const data = await getSettlement();
      setIdentity(data.identity);
      setSettlement(data.settlement);
      setPaymentEmail(data.paymentEmail ?? '');
      setIsFormOpen(Boolean(data.identity && !data.settlement && !isUnder14(data.identity.birth_date)));
    } catch (error) {
      setErrorMessage(getMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setThemeMode(getStoredThemeMode());
    setIsMounted(true);
  }, [setThemeMode]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    applyThemeMode(themeMode);

    const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

    function handleSystemThemeModeChange() {
      if (themeMode === 'system') {
        applyThemeMode('system');
      }
    }

    mediaQueryList.addEventListener('change', handleSystemThemeModeChange);

    return () => {
      mediaQueryList.removeEventListener('change', handleSystemThemeModeChange);
    };
  }, [isMounted, themeMode]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }
  }, [isMounted]);

  const isUnder14Age = Boolean(identity && isUnder14(identity.birth_date));

  const content = (() => {
    if (isLoading) {
      return (
        <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 240 }}>
          <LoadingIndicator />
        </Stack>
      );
    }

    if (!identity) {
      return (
        <Stack gap={2}>
          <Typography variant="body2">작가 신청을 하려면 먼저 본인인증이 필요합니다.</Typography>
          <IdentityVerificationButton className="button small submit" onVerified={() => void load()} />
        </Stack>
      );
    }

    if (isUnder14Age) {
      return (
        <Stack gap={2}>
          <Typography variant="body2">
            만 14세 미만은 작가 신청을 할 수 없어요.
            <br />
            수익이 발생하는 서비스는 관련 법률에 따라 아직은 이용이 어려워요.
          </Typography>
        </Stack>
      );
    }

    if (!settlement) {
      return isFormOpen ? null : (
        <Typography variant="body2">본인인증이 완료되었습니다. 정산정보를 입력해 주세요.</Typography>
      );
    }

    return (
      <Stack gap={2}>
        <p className="alert info">
          <InfoOutlineRoundedIcon />
          <span>
            {settlement.account_verified_at
              ? '정산정보가 확인되었습니다. 감사합니다.'
              : '작가 신청결과를 확인하는 중입니다.'}
          </span>
        </p>
        <Stack gap={2}>
          <Stack gap={1}>
            <Typography variant="subtitle2">개인/사업자 여부</Typography>
            <Typography variant="body2">{getSettlementTypeLabel(settlement.settlement_type)}</Typography>
          </Stack>
          {settlement.settlement_type === 'individual' ? (
            <>
              <Stack gap={1}>
                <Typography variant="subtitle2">업종코드</Typography>
                <Typography variant="body2">{getBusinessIncomeCodeLabel(settlement.business_income_code)}</Typography>
              </Stack>
            </>
          ) : (
            <>
              <Stack gap={1}>
                <Typography variant="subtitle2">단체/회사명</Typography>
                <Typography variant="body2">{settlement.company_name}</Typography>
              </Stack>
              <Stack gap={1}>
                <Typography variant="subtitle2">사업자등록번호</Typography>
                <Typography variant="body2">{settlement.business_registration_number}</Typography>
              </Stack>
              <Stack gap={1}>
                <Typography variant="subtitle2">사업자등록증</Typography>
                <Typography variant="body2">등록됨</Typography>
              </Stack>
            </>
          )}
          <Stack gap={1}>
            <Typography variant="subtitle2">정산 안내 이메일</Typography>
            <Typography variant="body2">{paymentEmail}</Typography>
          </Stack>
          <Stack gap={1}>
            <Typography variant="subtitle2">정산 정보</Typography>
            <Typography variant="body2">
              {getBankLabel(settlement.bank_code)} / {settlement.account_holder} / {settlement.account_number}
            </Typography>
          </Stack>
          {settlement.status !== 'approved' && !isFormOpen ? (
            <Stack direction="row" justifyContent="flex-end" gap={2}>
              <Anchor href="/" className="button medium action">
                라운지로 이동
              </Anchor>
              <button type="button" className="button medium submit" onClick={() => setIsFormOpen(true)}>
                정산정보 수정
              </button>
            </Stack>
          ) : null}
        </Stack>
      </Stack>
    );
  })();

  return (
    <main className={styles['new-generation']}>
      <div className={styles.container}>
        <div className={`content ${styles.content}`}>
          <h1>작가 신청</h1>
          {content ? <div className="paper">{content}</div> : null}

          {isFormOpen && identity && !isUnder14Age ? <SettlementForm onSuccess={() => void load()} /> : null}
        </div>
      </div>
    </main>
  );
}
