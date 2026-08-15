'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import {
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  FormGroup,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  styled,
  TextField,
  Typography,
} from '@mui/material';
import { BANK_OPTIONS, BUSINESS_INCOME_CODE_OPTIONS } from '@/lib/settlement/options';
import Anchor from '@/components/Anchor';
import IdentityAgreement from '@/components/service/common/IdentityAgreement';
import IdentityVerificationButton from '@/components/service/common/IdentityVerificationButton';

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

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

function onlyDigits(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '');
}

function normalizeComparableText(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .replace(/\s/g, '');
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

function getBirthDatePrefix(birthDate: string) {
  const digits = onlyDigits(birthDate);

  return digits.length === 8 ? digits.slice(2, 8) : digits.slice(0, 6);
}

function getExpectedResidentGenderDigits(identity: Identity) {
  const year = Number(onlyDigits(identity.birth_date).slice(0, 4));

  if (identity.gender === 'MALE') {
    return year >= 2000 ? ['3'] : ['1'];
  }

  if (identity.gender === 'FEMALE') {
    return year >= 2000 ? ['4'] : ['2'];
  }

  return [];
}

function isValidResidentRegistrationNumber(value: string) {
  if (!/^\d{13}$/.test(value)) {
    return false;
  }

  const weights = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
  const sum = weights.reduce((total, weight, index) => total + Number(value[index]) * weight, 0);

  return (11 - (sum % 11)) % 10 === Number(value[12]);
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

async function getSettlement() {
  const response = await fetch('/api/settlement', { credentials: 'include', cache: 'no-store' });
  const data = (await response.json().catch(() => null)) as SettlementResponse | { message?: string } | null;

  if (!response.ok) {
    throw new Error(isMessageResponse(data) ? data.message : '정산 정보를 불러오지 못했습니다.');
  }

  return data as SettlementResponse;
}

type GuardianIdentity = {
  name: string;
  birth_date: string;
  gender: string;
};

function isMinorAge(birthDate: string | null | undefined) {
  if (!birthDate) return false;
  const digits = birthDate.replace(/\D/g, '');
  if (digits.length !== 8) return false;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const today = new Date();
  const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
  let age = today.getFullYear() - year;
  if (today < birthdayThisYear) age -= 1;
  return age < 19;
}

export default function SettlementForm({ onSuccess }: { onSuccess?: () => void }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [paymentEmail, setPaymentEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [settlementAgreementOpen, setSettlementAgreementOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [settlementType, setSettlementType] = useState<SettlementType>('individual');
  const [residentSuffix, setResidentSuffix] = useState('');
  const [residentSuffixConfirm, setResidentSuffixConfirm] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState('');
  const [businessLicenseFile, setBusinessLicenseFile] = useState<File | null>(null);
  const [businessIncomeCode, setBusinessIncomeCode] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [isSettlementAgreed, setIsSettlementAgreed] = useState(false);
  const [guardianIdentity, setGuardianIdentity] = useState<GuardianIdentity | null>(null);
  const [guardianDocumentFile, setGuardianDocumentFile] = useState<File | null>(null);
  const [isGuardianVerifying, setIsGuardianVerifying] = useState(false);
  const [guardianErrorMessage, setGuardianErrorMessage] = useState('');
  const guardianDocumentRef = useRef<HTMLInputElement>(null);

  const isApproved = settlement?.status === 'approved';
  const needsGuardian = Boolean(identity && isMinorAge(identity.birth_date));

  const load = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const data = await getSettlement();
      setIdentity(data.identity);
      setSettlement(data.settlement);
      setPaymentEmail(data.paymentEmail ?? '');
      setIsFormOpen(Boolean(data.identity && !data.settlement));
    } catch (error) {
      setErrorMessage(getMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleBusinessLicenseChange = (event: ChangeEvent<HTMLInputElement>) => {
    setBusinessLicenseFile(event.target.files?.[0] ?? null);
  };

  const handleGuardianVerify = async () => {
    if (isGuardianVerifying) return;
    setIsGuardianVerifying(true);
    setGuardianErrorMessage('');
    try {
      // Step 1: Get PortOne request params
      const startRes = await fetch('/api/identity/portone/guardian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const startData = (await startRes.json().catch(() => null)) as {
        storeId: string;
        channelKey: string;
        identityVerificationId: string;
      } | null;

      if (!startRes.ok || !startData) {
        throw new Error('법정대리인 본인인증을 시작할 수 없습니다.');
      }

      // Step 2: Open PortOne identity verification popup
      const PortOne = (await import('@portone/browser-sdk/v2')).default;
      const result = await PortOne.requestIdentityVerification(startData);
      const identityVerificationId = result?.identityVerificationId ?? startData.identityVerificationId;

      if (!identityVerificationId || result?.code) {
        throw new Error(result?.message || '법정대리인 본인인증이 완료되지 않았습니다.');
      }

      // Step 3: Verify with server (checks guardian is adult)
      const verifyRes = await fetch('/api/identity/portone/guardian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identityVerificationId }),
      });
      const verifyData = (await verifyRes.json().catch(() => null)) as GuardianIdentity | { message?: string } | null;

      if (!verifyRes.ok) {
        throw new Error(
          (verifyData as { message?: string })?.message ?? '법정대리인 본인인증 결과를 확인할 수 없습니다.',
        );
      }

      setGuardianIdentity(verifyData as GuardianIdentity);
    } catch (error) {
      setGuardianErrorMessage(getMessage(error));
    } finally {
      setIsGuardianVerifying(false);
    }
  };

  const handleGuardianDocumentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (file && (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf'))) {
      setGuardianDocumentFile(null);
      setGuardianErrorMessage('가족관계증명서는 PDF 파일만 첨부할 수 있습니다.');
      event.target.value = '';
      return;
    }

    setGuardianErrorMessage('');
    setGuardianDocumentFile(file);
  };

  const handleSubmit = async () => {
    if (!identity || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      if (!paymentEmail.trim()) {
        throw new Error('연락할 수 있는 이메일 주소를 입력해 주세요.');
      }

      if (!isSettlementAgreed) {
        throw new Error('정산정보 수집·이용에 동의해 주세요.');
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paymentEmail.trim())) {
        throw new Error('이메일 주소 형식이 올바르지 않습니다.');
      }

      if (!bankCode || !accountHolder.trim() || !accountNumber) {
        throw new Error('계좌 정보를 입력해 주세요.');
      }

      if (
        settlementType === 'individual' &&
        normalizeComparableText(accountHolder) !== normalizeComparableText(identity.name)
      ) {
        throw new Error('예금주는 본인인증한 성명과 일치해야 합니다.');
      }

      if (needsGuardian) {
        if (!guardianIdentity) {
          throw new Error('법정대리인 본인인증을 완료해 주세요.');
        }
        if (!guardianDocumentFile) {
          throw new Error('가족관계증명서 PDF 파일을 첨부해 주세요.');
        }
        if (
          guardianDocumentFile.type !== 'application/pdf' ||
          !guardianDocumentFile.name.toLowerCase().endsWith('.pdf')
        ) {
          throw new Error('가족관계증명서는 PDF 파일만 첨부할 수 있습니다.');
        }
      }

      const formData = new FormData();
      formData.append('settlement_type', settlementType);
      formData.append('payment_email', paymentEmail.trim());
      formData.append('bank_code', bankCode);
      formData.append('account_holder', accountHolder.trim());
      formData.append('account_number', accountNumber);

      if (needsGuardian && guardianIdentity) {
        formData.append('guardian_name', guardianIdentity.name);
        formData.append('guardian_birth_date', guardianIdentity.birth_date);
        formData.append('guardian_gender', guardianIdentity.gender);
      }
      if (needsGuardian && guardianDocumentFile) {
        formData.append('guardian_document_file', guardianDocumentFile);
      }

      if (settlementType === 'individual') {
        const birthDatePrefix = getBirthDatePrefix(identity.birth_date);
        const expectedGenderDigits = getExpectedResidentGenderDigits(identity);

        if (residentSuffix.length !== 7 || residentSuffixConfirm.length !== 7) {
          throw new Error('주민등록번호 뒷자리를 입력해 주세요.');
        }

        if (residentSuffix !== residentSuffixConfirm) {
          throw new Error('주민등록번호 뒷자리 확인값이 일치하지 않습니다.');
        }

        if (expectedGenderDigits.length > 0 && !expectedGenderDigits.includes(residentSuffix.slice(0, 1))) {
          throw new Error('주민등록번호 뒷자리 첫 숫자가 본인인증 정보와 일치하지 않습니다.');
        }

        const residentRegistrationNumber = `${birthDatePrefix}${residentSuffix}`;

        if (!isValidResidentRegistrationNumber(residentRegistrationNumber)) {
          throw new Error('주민등록번호 형식이 올바르지 않습니다.');
        }

        if (!businessIncomeCode) {
          throw new Error('업종코드를 선택해 주세요.');
        }

        formData.append('resident_registration_number', residentRegistrationNumber);
        formData.append('business_income_code', businessIncomeCode);
      } else {
        if (businessRegistrationNumber.length !== 10) {
          throw new Error('사업자등록번호를 입력해 주세요.');
        }

        if (!companyName.trim()) {
          throw new Error('단체/회사명을 입력해 주세요.');
        }

        if (
          settlementType === 'corporation' &&
          normalizeComparableText(accountHolder) !== normalizeComparableText(companyName)
        ) {
          throw new Error('법인 예금주는 단체/회사명과 일치해야 합니다.');
        }

        if (!businessLicenseFile && !settlement?.business_license) {
          throw new Error('사업자등록증 PDF를 등록해 주세요.');
        }

        if (businessLicenseFile && businessLicenseFile.type !== 'application/pdf') {
          throw new Error('사업자등록증은 PDF 파일만 등록할 수 있습니다.');
        }

        formData.append('company_name', companyName.trim());
        formData.append('business_registration_number', businessRegistrationNumber);

        if (businessLicenseFile) {
          formData.append('business_license', businessLicenseFile);
        }
      }

      const response = await fetch(settlement ? '/api/settlement/edit' : '/api/settlement/new', {
        method: settlement ? 'PATCH' : 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(data?.message ?? '정산 정보를 저장하지 못했습니다.');
      }

      const agreementResponse = await fetch('/api/identity/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'settlement' }),
      });
      const agreementData = (await agreementResponse.json().catch(() => null)) as { message?: string } | null;

      if (!agreementResponse.ok) {
        throw new Error(agreementData?.message ?? '동의 내용을 저장하지 못했습니다.');
      }

      await load();
      onSuccess?.();
    } catch (error) {
      setErrorMessage(getMessage(error));
      setIsSubmitting(false);
    }
  };

  const content = (() => {
    if (isLoading) {
      return <Typography variant="body2">정보를 불러오는 중입니다.</Typography>;
    }

    if (!identity) {
      return (
        <Stack gap={2}>
          <Typography variant="body2">작가 신청을 하려면 먼저 본인인증이 필요합니다.</Typography>
          <IdentityVerificationButton className="button small submit" onVerified={() => void load()} />
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
              {settlement.status !== 'approved' && !isFormOpen ? (
                <button type="button" className="button medium submit" onClick={() => setIsFormOpen(true)}>
                  정산정보 수정
                </button>
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      </Stack>
    );
  })();

  return (
    <>
      {content ? <div className="paper">{content}</div> : null}

      {isFormOpen && identity ? (
        <div className="paper">
          <Stack gap={2}>
            {errorMessage ? <p className="alert error">{errorMessage}</p> : null}
            <Stack gap={1}>
              <Typography variant="subtitle2">개인/기업 선택</Typography>
              <RadioGroup
                {...(isApproved ? { sx: { pointerEvents: 'none', opacity: 0.7 } } : {})}
                row
                value={settlementType === 'individual' ? 'individual' : 'business'}
                onChange={(event) => {
                  setSettlementType(event.target.value === 'individual' ? 'individual' : 'individual_business');
                }}
              >
                <FormControlLabel value="individual" control={<Radio />} label="개인" />
                <FormControlLabel value="business" control={<Radio />} label="기업" />
              </RadioGroup>
            </Stack>

            {settlementType === 'individual' ? (
              <Stack gap={2}>
                <Stack gap={1}>
                  <Typography variant="subtitle2">성명</Typography>
                  <Typography variant="body2">{identity.name}</Typography>
                </Stack>
                <Stack gap={1}>
                  <Typography variant="subtitle2">주민등록번호</Typography>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Typography variant="body2">{getBirthDatePrefix(identity.birth_date)}</Typography>
                    <Typography variant="body2">-</Typography>
                    <TextField
                      disabled={isApproved}
                      size="small"
                      type="password"
                      placeholder="주민등록번호 뒷자리"
                      value={residentSuffix}
                      onChange={(event) => setResidentSuffix(onlyDigits(event.target.value).slice(0, 7))}
                      slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 7 } }}
                    />
                    <TextField
                      disabled={isApproved}
                      size="small"
                      type="password"
                      placeholder="주민등록번호 뒷자리 확인"
                      value={residentSuffixConfirm}
                      onChange={(event) => setResidentSuffixConfirm(onlyDigits(event.target.value).slice(0, 7))}
                      slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 7 } }}
                    />
                  </Stack>
                </Stack>

                <Stack gap={1}>
                  <Typography variant="subtitle2">업종 선택</Typography>
                  <Select
                    disabled={isApproved}
                    size="small"
                    displayEmpty
                    value={businessIncomeCode}
                    onChange={(event) => setBusinessIncomeCode(event.target.value)}
                  >
                    <MenuItem value="" disabled>
                      업종코드를 선택해 주세요
                    </MenuItem>
                    {BUSINESS_INCOME_CODE_OPTIONS.map((option) => (
                      <MenuItem key={option.code} value={option.code}>
                        {option.code} ({option.label})
                      </MenuItem>
                    ))}
                  </Select>
                </Stack>
              </Stack>
            ) : (
              <Stack gap={2}>
                <Typography variant="subtitle2">사업자 선택</Typography>
                <RadioGroup
                  {...(isApproved ? { sx: { pointerEvents: 'none', opacity: 0.7 } } : {})}
                  row
                  value={settlementType}
                  onChange={(event) => setSettlementType(event.target.value as SettlementType)}
                >
                  <FormControlLabel value="individual_business" control={<Radio />} label="개인사업자" />
                  <FormControlLabel value="corporation" control={<Radio />} label="법인" />
                </RadioGroup>
                <Stack gap={1}>
                  <Typography variant="subtitle2">단체/회사명</Typography>
                  <TextField
                    disabled={isApproved}
                    fullWidth
                    size="small"
                    placeholder="단체/회사명"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                  />
                </Stack>
                <Stack gap={1}>
                  <Typography variant="subtitle2">사업자등록번호/등록증</Typography>
                  <TextField
                    disabled={isApproved}
                    fullWidth
                    size="small"
                    placeholder="사업자등록번호"
                    value={businessRegistrationNumber}
                    onChange={(event) => setBusinessRegistrationNumber(onlyDigits(event.target.value).slice(0, 10))}
                    slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 10 } }}
                  />
                  <Button component="label" className="button small action" disabled={isApproved}>
                    사업자등록증 PDF 선택
                    <input type="file" accept="application/pdf" hidden onChange={handleBusinessLicenseChange} />
                  </Button>
                  {businessLicenseFile ? <Typography variant="body2">{businessLicenseFile.name}</Typography> : null}
                </Stack>
              </Stack>
            )}

            <Stack gap={1}>
              <Typography variant="subtitle2">정산 안내 이메일</Typography>
              <TextField
                disabled={isApproved}
                fullWidth
                size="small"
                type="email"
                placeholder="정산 안내 이메일"
                value={paymentEmail}
                onChange={(event) => setPaymentEmail(event.target.value)}
              />
            </Stack>
            <Stack gap={1}>
              <Typography variant="subtitle2">정산 정보 입력</Typography>
              <Stack gap={1}>
                <Select
                  disabled={isApproved}
                  size="small"
                  displayEmpty
                  value={bankCode}
                  onChange={(event) => setBankCode(event.target.value)}
                >
                  <MenuItem value="" disabled>
                    입금 은행을 선택해 주세요
                  </MenuItem>
                  {BANK_OPTIONS.map((option) => (
                    <MenuItem key={option.code} value={option.code}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
                <TextField
                  disabled={isApproved}
                  fullWidth
                  size="small"
                  placeholder="예금주"
                  value={accountHolder}
                  onChange={(event) => setAccountHolder(event.target.value)}
                  helperText={
                    settlementType === 'individual'
                      ? '본인인증한 성명과 동일하게 입력해 주세요.'
                      : settlementType === 'corporation'
                        ? '단체/회사명과 동일하게 입력해 주세요.'
                        : '개인사업자 계좌 또는 본인 개인 계좌를 사용할 수 있습니다.'
                  }
                />
                <TextField
                  disabled={isApproved}
                  fullWidth
                  size="small"
                  placeholder="계좌번호"
                  value={accountNumber}
                  onChange={(event) => setAccountNumber(onlyDigits(event.target.value))}
                  slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                />
              </Stack>
              {errorMessage ? (
                <p className="alert error">
                  <ErrorOutlineRoundedIcon />
                  <span>{errorMessage}</span>
                </p>
              ) : null}
            </Stack>
            {needsGuardian ? (
              <Stack gap={1.5}>
                <Divider />
                <Typography variant="subtitle2">법정대리인 동의 (만 14세 이상 ~ 만 19세 미만 필수)</Typography>
                <Typography variant="body2" color="text.secondary">
                  미성년자 작가 신청에는 민법 제5조에 따라 법정대리인(부모님 등) 중 한 분의 동의가 필요합니다. 아래
                  버튼으로 법정대리인 본인인증을 완료하고 가족관계증명서를 첨부해 주세요.
                </Typography>
                {guardianIdentity ? (
                  <p className="alert info">
                    <InfoOutlineRoundedIcon />
                    <span>법정대리인 {guardianIdentity.name}</span>
                  </p>
                ) : (
                  <div>
                    <button
                      type="button"
                      className="button small action"
                      onClick={() => void handleGuardianVerify()}
                      disabled={isGuardianVerifying}
                    >
                      {isGuardianVerifying ? '인증 중...' : '법정대리인 본인인증'}
                    </button>
                  </div>
                )}
                {guardianErrorMessage ? <p className="alert error">{guardianErrorMessage}</p> : null}
                <Divider />
                <Stack gap={1}>
                  <Typography variant="subtitle2">가족관계증명서 첨부</Typography>
                  <Typography variant="body2" color="text.secondary">
                    정부24(www.gov.kr)에서 발급받은 가족관계증명서 PDF를 업로드해 주세요.
                  </Typography>
                  <div>
                    <Button component="label" className="button small action">
                      파일 선택
                      <VisuallyHiddenInput
                        ref={guardianDocumentRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handleGuardianDocumentChange}
                      />
                    </Button>
                  </div>
                  {guardianDocumentFile ? <Typography variant="body2">{guardianDocumentFile.name}</Typography> : null}
                </Stack>
              </Stack>
            ) : null}
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    disabled={isApproved}
                    checked={isSettlementAgreed}
                    onChange={(event) => setIsSettlementAgreed(event.target.checked)}
                  />
                }
                label={
                  <button type="button" className="link-normal" onClick={() => setSettlementAgreementOpen(true)}>
                    [필수] 정산정보 수집·이용 동의
                  </button>
                }
              />
            </FormGroup>
            <Stack direction="row" justifyContent="flex-end" gap={1}>
              <button
                type="button"
                className="button medium action"
                onClick={() => setIsFormOpen(false)}
                disabled={isSubmitting || isApproved}
              >
                취소
              </button>
              <button
                type="button"
                className="button medium submit"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting || isApproved}
              >
                {isSubmitting ? '저장 중' : settlement ? '정산정보 수정' : '작가 신청'}
              </button>
            </Stack>
          </Stack>
        </div>
      ) : null}
      <IdentityAgreement
        type="settlement"
        open={settlementAgreementOpen}
        onClose={() => setSettlementAgreementOpen(false)}
        showAgreementCheck={false}
      />
    </>
  );
}
