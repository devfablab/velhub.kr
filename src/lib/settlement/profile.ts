import { decrypt } from '@/lib/encryption/decrypt';
import { encrypt } from '@/lib/encryption/encrypt';

export type SettlementType = 'individual' | 'business';

export type SettlementProfileRow = {
  name: string | number | null;
  birth_date: string | number | null;
  gender: string | number | null;
  identity_verified_at: string | null;
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

export function serializeSettlementProfile(row: SettlementProfileRow | null) {
  if (!row) {
    return {
      exists: false,
      identity: null,
      settlement: null,
    };
  }

  const name = decryptNullable(row.name);
  const birthDate = decryptNullable(row.birth_date);
  const gender = decryptNullable(row.gender);

  return {
    exists: true,
    identity:
      row.identity_verified_at && name && birthDate && gender
        ? {
            name,
            birth_date: birthDate,
            gender,
            identity_verified_at: row.identity_verified_at,
          }
        : null,
    settlement: row.settlement_type
      ? {
          settlement_type: row.settlement_type,
          resident_registration_number: maskResidentRegistrationNumber(
            row.resident_registration_number,
            row.birth_date,
          ),
          company_name: decryptNullable(row.company_name),
          business_registration_number: decryptNullable(row.business_registration_number),
          business_license: row.business_license,
          business_income_code: row.business_income_code,
          bank_code: row.bank_code,
          account_number: decryptNullable(row.account_number),
          account_holder: decryptNullable(row.account_holder),
          account_verified_at: row.account_verified_at,
        }
      : null,
  };
}

export function validateSettlementProfileInput(value: unknown) {
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

  if (settlementType !== 'individual' && settlementType !== 'business') {
    return {
      ok: false as const,
      message: '정산 유형이 올바르지 않습니다.',
    };
  }

  const validSettlementType: SettlementType = settlementType;

  if (settlementType !== 'individual' && settlementType !== 'business') {
    return {
      ok: false as const,
      message: '정산 유형이 올바르지 않습니다.',
    };
  }

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

  return {
    ok: true as const,
    data: {
      settlement_type: validSettlementType,
      company_name: input.company_name ? normalizeText(input.company_name) : null,
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

export function createSettlementProfileUpdatePayload(data: ValidatedSettlementProfileInput) {
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
