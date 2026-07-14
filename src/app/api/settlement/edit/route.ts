import { NextRequest, NextResponse } from 'next/server';
import { createSettlementProfileUpdatePayload, validateSettlementProfileInput } from '@/lib/settlement/profile';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { encrypt } from '@/lib/encryption/encrypt';

const BUSINESS_LICENSE_BUCKET = 'business-license';

type ExistingSettlementRow = {
  user_id: string;
  identity_verified_at: string | null;
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
    console.log('error: ', error);

    throw new Error('사업자등록증 업로드에 실패했습니다.');
  }

  return filePath;
}

export async function PATCH(request: NextRequest) {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims?.userId) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: existingRow, error: findError } = await supabaseAdmin
    .from('chorogons')
    .select('user_id, identity_verified_at, settlement_type, business_license')
    .eq('user_id', sessionClaims.userId)
    .limit(1)
    .maybeSingle();

  if (findError) {
    console.log('error: ', findError);

    return NextResponse.json({ message: '정산 정보 확인에 실패했습니다.' }, { status: 500 });
  }

  const settlementRow = existingRow as ExistingSettlementRow | null;

  if (!settlementRow?.identity_verified_at) {
    return NextResponse.json({ message: '본인인증이 필요합니다.' }, { status: 403 });
  }

  if (!settlementRow.settlement_type) {
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

    if (settlementType === 'business') {
      if (businessLicenseFile) {
        businessLicense = await uploadBusinessLicenseFile(sessionClaims.userId, businessLicenseFile);
      } else if (settlementRow.business_license) {
        businessLicense = settlementRow.business_license;
      } else {
        return NextResponse.json({ message: '사업자등록증 PDF를 등록해 주세요.' }, { status: 400 });
      }
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
    };

    const validatedInput = validateSettlementProfileInput(input);

    if (!validatedInput.ok) {
      return NextResponse.json({ message: validatedInput.message }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('chorogons')
      .update(createSettlementProfileUpdatePayload(validatedInput.data))
      .eq('user_id', sessionClaims.userId);

    if (error) {
      console.log('error: ', error);

      return NextResponse.json({ message: '정산 정보 수정에 실패했습니다.' }, { status: 500 });
    }

    const { error: paymentEmailError } = await supabaseAdmin
      .from('stigmas')
      .update({
        payment_email: encrypt(paymentEmail),
      })
      .eq('user_id', sessionClaims.userId);

    if (paymentEmailError) {
      console.log('error: ', paymentEmailError);
      return NextResponse.json({ message: '정산 이메일 수정에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 500 });
  }
}
