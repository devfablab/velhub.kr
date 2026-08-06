import { decrypt } from '@/lib/encryption/decrypt';
import { encrypt } from '@/lib/encryption/encrypt';

export type SettlementType = 'individual' | 'individual_business' | 'corporation' | 'business';

export type IdentityProfileRow = {
  name: string | number | null;
  birth_date: string | number | null;
  gender: string | number | null;
  identity_verified_at: string | null;
};

export type SettlementProfileRow = {
  settlement_type: SettlementType | null;
  resident_registration_number: string | number | null;
  business_registration_number: string | number | null;
  business_license: string | null;
  business_income_code: string | null;
  bank_code: string | null;
  account_number: string | number | null;
  account_holder: string | number | null;
  account_verified_at: string | null;
  company_name: string | null;
  status: string | null;
};

type SettlementProfileInput = {
  settlement_type?: string;
  resident_registration_number?: string;
  business_registration_number?: string;
  business_license?: string;
  business_income_code?: string;
  bank_code?: string;
  account_number?: string;
  account_holder?: string;
  company_name?: string | null;
};

type ValidatedSettlementProfileInput = {
  settlement_type: SettlementType;
  resident_registration_number: string | null;
  business_registration_number: string | null;
  business_license: string | null;
  business_income_code: string | null;
  bank_code: string;
  account_number: string;
  account_holder: string;
  company_name?: string | null;
};

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDigits(value: unknown) {
  return normalizeText(value).replace(/\D/g, '');
}

function normalizeComparableText(value: unknown) {
  return normalizeText(value).replace(/\s/g, '');
}

function decryptNullable(value: string | number | null) {
  if (value === null) {
    return null;
  }

  return decrypt(String(value));
}

function getBirthDatePrefix(value: string | number | null) {
  const birthDate = decryptNullable(value);

  if (!birthDate) {
    return '';
  }

  const digits = birthDate.replace(/\D/g, '');

  if (digits.length === 8) {
    return digits.slice(2, 8);
  }

  if (digits.length === 6) {
    return digits;
  }

  return '';
}

export function maskResidentRegistrationNumber(
  residentRegistrationNumber: string | number | null,
  birthDate: string | number | null,
) {
  const birthDatePrefix = getBirthDatePrefix(birthDate);
  const residentRegistrationValue = decryptNullable(residentRegistrationNumber);

  if (!birthDatePrefix || !residentRegistrationValue) {
    return null;
  }

  const digits = residentRegistrationValue.replace(/\D/g, '');
  const genderDigit = digits.length >= 7 ? digits.slice(6, 7) : '';

  if (!genderDigit) {
    return null;
  }

  return `${birthDatePrefix}-${genderDigit}••••••`;
}

export function serializeSettlementProfile(
  identityRow: IdentityProfileRow | null,
  settlementRow: SettlementProfileRow | null,
) {
  if (!identityRow) {
    return {
      exists: false,
      identity: null,
      settlement: null,
    };
  }

  const name = decryptNullable(identityRow.name);
  const birthDate = decryptNullable(identityRow.birth_date);
  const gender = decryptNullable(identityRow.gender);

  return {
    exists: true,
    identity:
      identityRow.identity_verified_at && name && birthDate && gender
        ? {
            name,
            birth_date: birthDate,
            gender,
            identity_verified_at: identityRow.identity_verified_at,
          }
        : null,
    settlement: settlementRow?.settlement_type
      ? {
          settlement_type: settlementRow.settlement_type,
          resident_registration_number: maskResidentRegistrationNumber(
            settlementRow.resident_registration_number,
            identityRow.birth_date,
          ),
          company_name: decryptNullable(settlementRow.company_name),
          business_registration_number: decryptNullable(settlementRow.business_registration_number),
          business_license: settlementRow.business_license,
          business_income_code: settlementRow.business_income_code,
          bank_code: settlementRow.bank_code,
          account_number: decryptNullable(settlementRow.account_number),
          account_holder: decryptNullable(settlementRow.account_holder),
          account_verified_at: settlementRow.account_verified_at,
          status: settlementRow.status,
        }
      : null,
  };
}

export function validateSettlementProfileInput(value: unknown, identityName?: string | null) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      ok: false as const,
      message: '요청 형식이 올바르지 않습니다.',
    };
  }

  const input = value as SettlementProfileInput;
  const settlementType = input.settlement_type;
  const bankCode = normalizeDigits(input.bank_code);
  const accountNumber = normalizeDigits(input.account_number);
  const accountHolder = normalizeText(input.account_holder);

  if (
    settlementType !== 'individual' &&
    settlementType !== 'individual_business' &&
    settlementType !== 'corporation'
  ) {
    return {
      ok: false as const,
      message: '정산 유형이 올바르지 않습니다.',
    };
  }

  const validSettlementType: SettlementType = settlementType;

  if (!bankCode || !accountNumber || !accountHolder) {
    return {
      ok: false as const,
      message: '계좌 정보가 올바르지 않습니다.',
    };
  }

  if (settlementType === 'individual') {
    const residentRegistrationNumber = normalizeDigits(input.resident_registration_number);
    const businessIncomeCode = normalizeDigits(input.business_income_code);

    if (residentRegistrationNumber.length !== 13) {
      return {
        ok: false as const,
        message: '주민등록번호가 올바르지 않습니다.',
      };
    }

    if (!businessIncomeCode) {
      return {
        ok: false as const,
        message: '업종코드가 필요합니다.',
      };
    }

    if (
      !identityName ||
      normalizeComparableText(accountHolder) !== normalizeComparableText(identityName)
    ) {
      return {
        ok: false as const,
        message: '예금주는 본인인증한 성명과 일치해야 합니다.',
      };
    }

    return {
      ok: true as const,
      data: {
        settlement_type: validSettlementType,
        resident_registration_number: residentRegistrationNumber,
        business_registration_number: null,
        business_license: null,
        business_income_code: businessIncomeCode,
        bank_code: bankCode,
        account_number: accountNumber,
        account_holder: accountHolder,
      },
    };
  }

  const businessRegistrationNumber = normalizeDigits(input.business_registration_number);
  const businessLicense = normalizeText(input.business_license);
  const companyName = normalizeText(input.company_name);

  if (businessRegistrationNumber.length !== 10) {
    return {
      ok: false as const,
      message: '사업자등록번호가 올바르지 않습니다.',
    };
  }

  if (!businessLicense) {
    return {
      ok: false as const,
      message: '사업자등록증이 필요합니다.',
    };
  }

  if (!companyName) {
    return {
      ok: false as const,
      message: '단체/회사명을 입력해 주세요.',
    };
  }

  if (
    settlementType === 'corporation' &&
    normalizeComparableText(accountHolder) !== normalizeComparableText(companyName)
  ) {
    return {
      ok: false as const,
      message: '법인 예금주는 단체/회사명과 일치해야 합니다.',
    };
  }

  return {
    ok: true as const,
    data: {
      settlement_type: validSettlementType,
      company_name: companyName,
      resident_registration_number: null,
      business_registration_number: businessRegistrationNumber,
      business_license: businessLicense,
      business_income_code: null,
      bank_code: bankCode,
      account_number: accountNumber,
      account_holder: accountHolder,
    },
  };
}

export function toSettlementPayload(data: ValidatedSettlementProfileInput) {
  return {
    settlement_type: data.settlement_type,
    resident_registration_number: data.resident_registration_number ? encrypt(data.resident_registration_number) : null,
    business_registration_number: data.business_registration_number ? encrypt(data.business_registration_number) : null,
    company_name: data.company_name ? normalizeText(data.company_name) : null,
    business_license: data.business_license,
    business_income_code: data.business_income_code,
    bank_code: data.bank_code,
    account_number: encrypt(data.account_number),
    account_holder: encrypt(data.account_holder),
    account_verified_at: null,
    updated_at: new Date().toISOString(),
  };
}
