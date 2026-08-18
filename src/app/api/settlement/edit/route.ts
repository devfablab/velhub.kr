import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/encryption/decrypt';
import { encrypt } from '@/lib/encryption/encrypt';
import { getChorogonBirthDate } from '@/lib/identity/chorogon';
import { getSessionClaims } from '@/lib/session';
import { getCurrentStigma } from '@/lib/session/utils';
import { toSettlementPayload, validateSettlementProfileInput } from '@/lib/settlement/profile';
import { getSupabaseAdmin } from '@/lib/supabase';

const BUSINESS_LICENSE_BUCKET = 'business-license';
const FAMILY_RELATION_CERTIFICATE_BUCKET = 'family-relation-certificates';

type ExistingSettlementRow = {
  id: string;
  name: string | null;
  identity_verified_at: string | null;
  parent_relationship_document_url: string | null;
};

type ExistingBanqueRow = {
  id: string;
  settlement_type: string | null;
  business_license: string | null;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === 'string' ? value : '';
}

function getFile(formData: FormData, key: string) {
  const value = formData.get(key);

  if (value instanceof File && value.size > 0) {
    return value;
  }

  return null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '요청 처리에 실패했습니다.';
}

function normalizePaymentEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidPaymentEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function uploadBusinessLicenseFile(userId: string, file: File) {
  if (file.type !== 'application/pdf') {
    throw new Error('사업자등록증은 PDF 파일만 등록할 수 있습니다.');
  }

  const supabaseAdmin = getSupabaseAdmin();
  const filePath = `${userId}/${crypto.randomUUID()}.pdf`;

  const { error } = await supabaseAdmin.storage.from(BUSINESS_LICENSE_BUCKET).upload(filePath, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error('사업자등록증 업로드에 실패했습니다.');
  }

  return filePath;
}

async function uploadGuardianDocumentFile(userId: string, file: File) {
  const header = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());

  if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf') || header !== '%PDF-') {
    throw new Error('가족관계증명서는 PDF 파일만 업로드할 수 있습니다.');
  }

  const supabaseAdmin = getSupabaseAdmin();
  const filePath = `${userId}/settlement/${crypto.randomUUID()}.pdf`;

  const { error } = await supabaseAdmin.storage.from(FAMILY_RELATION_CERTIFICATE_BUCKET).upload(filePath, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error('가족관계증명서 업로드에 실패했습니다.');
  }

  return filePath;
}

export async function PATCH(request: NextRequest) {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims?.userId) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const currentStigma = await getCurrentStigma();

  if (!currentStigma) {
    return NextResponse.json({ message: '계정 정보를 확인하지 못했습니다.' }, { status: 500 });
  }

  const { data: existingRow, error: findError } = await supabaseAdmin
    .from('chorogons')
    .select('id, name, birth_date, birth_date_dummy, identity_verified_at, parent_relationship_document_url')
    .eq('user_id', currentStigma.stigmaId)
    .limit(1)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ message: '정산 정보 확인에 실패했습니다.' }, { status: 500 });
  }

  const settlementRow = existingRow as ExistingSettlementRow | null;

  if (!settlementRow?.identity_verified_at) {
    return NextResponse.json({ message: '본인인증이 필요합니다.' }, { status: 403 });
  }

  const { data: existingBanqueRow, error: banqueFindError } = await supabaseAdmin
    .from('chorogons_banque')
    .select('id, settlement_type, business_license')
    .eq('chorogon_id', settlementRow.id)
    .maybeSingle();

  if (banqueFindError) {
    return NextResponse.json({ message: '정산 정보 확인에 실패했습니다.' }, { status: 500 });
  }

  const banqueRow = existingBanqueRow as ExistingBanqueRow | null;

  if (!banqueRow?.settlement_type) {
    return NextResponse.json({ message: '등록된 정산 정보가 없습니다.' }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const settlementType = getString(formData, 'settlement_type');
    const paymentEmail = normalizePaymentEmail(getString(formData, 'payment_email'));

    if (!isValidPaymentEmail(paymentEmail)) {
      return NextResponse.json({ message: '이메일 주소 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    const businessLicenseFile = getFile(formData, 'business_license');

    let businessLicense = '';

    if (settlementType === 'individual_business' || settlementType === 'corporation') {
      if (businessLicenseFile) {
        businessLicense = await uploadBusinessLicenseFile(sessionClaims.userId, businessLicenseFile);
      } else if (banqueRow.business_license) {
        businessLicense = banqueRow.business_license;
      } else {
        return NextResponse.json({ message: '사업자등록증 PDF를 등록해 주세요.' }, { status: 400 });
      }
    }

    const guardianDocumentFile = getFile(formData, 'guardian_document_file');
    let guardianDocumentUrl = '';

    if (guardianDocumentFile) {
      guardianDocumentUrl = await uploadGuardianDocumentFile(sessionClaims.userId, guardianDocumentFile);
    } else if (settlementRow.parent_relationship_document_url) {
      guardianDocumentUrl = settlementRow.parent_relationship_document_url;
    }

    const input = {
      settlement_type: settlementType,
      resident_registration_number: getString(formData, 'resident_registration_number'),
      business_registration_number: getString(formData, 'business_registration_number'),
      business_license: businessLicense,
      business_income_code: getString(formData, 'business_income_code'),
      bank_code: getString(formData, 'bank_code'),
      account_number: getString(formData, 'account_number'),
      account_holder: getString(formData, 'account_holder'),
      company_name: getString(formData, 'company_name'),
      guardian_name: getString(formData, 'guardian_name'),
      guardian_birth_date: getString(formData, 'guardian_birth_date'),
      guardian_gender: getString(formData, 'guardian_gender'),
      guardian_document_url: guardianDocumentUrl,
    };

    const identityName = settlementRow.name ? decrypt(settlementRow.name) : null;

    let isMinorAge = false;
    const identityBirthDate = getChorogonBirthDate(existingRow);
    if (identityBirthDate && identityBirthDate.replace(/\D/g, '').length === 8) {
      const digits = identityBirthDate.replace(/\D/g, '');
      const year = Number(digits.slice(0, 4));
      const month = Number(digits.slice(4, 6));
      const day = Number(digits.slice(6, 8));
      const today = new Date();
      const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
      let age = today.getFullYear() - year;
      if (today < birthdayThisYear) age -= 1;
      isMinorAge = age < 19;
    }

    const validatedInput = validateSettlementProfileInput(input, identityName, isMinorAge);

    if (!validatedInput.ok) {
      return NextResponse.json({ message: validatedInput.message }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('chorogons_banque')
      .update(toSettlementPayload(validatedInput.data))
      .eq('id', banqueRow.id);

    if (error) {
      return NextResponse.json({ message: '정산 정보 수정에 실패했습니다.' }, { status: 500 });
    }

    if (isMinorAge) {
      const guardianName = validatedInput.data.guardian_name;
      const guardianBirthDate = validatedInput.data.guardian_birth_date;
      const guardianGender = validatedInput.data.guardian_gender?.toUpperCase();
      const parentUpdate = {
        parent_relationship_document_url: validatedInput.data.guardian_document_url,
        parent_relationship_verified_at: null,
        parent_relationship_verified_by: null,
        ...(guardianGender === 'MALE' || guardianGender === 'M'
          ? {
              father_name: guardianName ? encrypt(guardianName) : null,
              father_birth_date: guardianBirthDate ? encrypt(guardianBirthDate) : null,
            }
          : {
              mother_name: guardianName ? encrypt(guardianName) : null,
              mother_birth_date: guardianBirthDate ? encrypt(guardianBirthDate) : null,
            }),
      };
      const { error: parentError } = await supabaseAdmin
        .from('chorogons')
        .update(parentUpdate)
        .eq('id', settlementRow.id);
      if (parentError) return NextResponse.json({ message: '법정대리인 정보를 저장하지 못했습니다.' }, { status: 500 });
    }

    const { error: paymentEmailError } = await supabaseAdmin
      .from('stigmas')
      .update({
        payment_email: encrypt(paymentEmail),
      })
      .eq('user_id', sessionClaims.userId);

    if (paymentEmailError) {
      return NextResponse.json({ message: '정산 이메일 수정에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 500 });
  }
}
