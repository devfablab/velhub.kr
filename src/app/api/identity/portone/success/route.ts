import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/encryption/decrypt';
import { createLookupHash, encrypt } from '@/lib/encryption/encrypt';
import { extractVerifiedIdentity, getPortOneIdentityVerification } from '@/lib/identity/portone';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { maskEmail } from '@/lib/utils';

type SuccessRequestBody = {
  identityVerificationId?: string;
  mockTxId?: string;
};

function isValidIdentityVerificationId(identityVerificationId: string, userId: string) {
  return identityVerificationId.startsWith(`identity-${userId}-`);
}

async function findExistingVerifiedAccount(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  ciHash: string | null,
  diHash: string | null,
) {
  const conditions = [ciHash ? `ci_hash.eq.${ciHash}` : '', diHash ? `di_hash.eq.${diHash}` : ''].filter(Boolean);

  if (!conditions.length) {
    return { exists: false, accountEmail: null, error: null };
  }

  const duplicateResult = await supabaseAdmin
    .from('chorogons')
    .select('user_id')
    .neq('user_id', userId)
    .or(conditions.join(','))
    .maybeSingle();

  if (duplicateResult.error) {
    return { exists: false, accountEmail: null, error: duplicateResult.error };
  }

  if (!duplicateResult.data) {
    return { exists: false, accountEmail: null, error: null };
  }

  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('email')
    .eq('id', duplicateResult.data.user_id)
    .maybeSingle();

  if (stigmaResult.error) {
    return { exists: true, accountEmail: null, error: stigmaResult.error };
  }

  try {
    return {
      exists: true,
      accountEmail: stigmaResult.data?.email ? decrypt(String(stigmaResult.data.email)) : null,
      error: null,
    };
  } catch {
    return { exists: true, accountEmail: null, error: null };
  }
}

export async function POST(request: NextRequest) {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims?.userId) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as SuccessRequestBody | null;
  const identityVerificationId = body?.identityVerificationId;

  if (!identityVerificationId) {
    return NextResponse.json({ message: '본인인증 요청 정보가 없습니다.' }, { status: 400 });
  }

  if (!isValidIdentityVerificationId(identityVerificationId, sessionClaims.userId)) {
    return NextResponse.json({ message: '본인인증 요청 정보가 일치하지 않습니다.' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  let verifiedIdentity = extractVerifiedIdentity(identityVerificationId, await getPortOneIdentityVerification(identityVerificationId));

  if (process.env.NEXT_PUBLIC_APP_ENV === 'test' && body?.mockTxId) {
    const { data: mock } = await supabaseAdmin.from('mock_identities').select('*').eq('verification_tx_id', body.mockTxId).single();
    if (mock) {
      verifiedIdentity = {
        identityVerificationId,
        name: mock.name,
        birthDate: mock.birth_date.replace(/\D/g, '').slice(0, 8),
        gender: mock.gender,
        ci: mock.ci,
        di: mock.ci,
      };
    }
  }

  if (!verifiedIdentity) {
    return NextResponse.json({ message: '본인인증 결과를 확인할 수 없습니다.' }, { status: 400 });
  }

  const { data: stigma, error: stigmaError } = await supabaseAdmin
    .from('stigmas')
    .select('id')
    .eq('user_id', sessionClaims.userId)
    .maybeSingle();

  if (stigmaError || !stigma) {
    return NextResponse.json({ message: '계정 정보를 확인하지 못했습니다.' }, { status: 500 });
  }

  const ciHash = verifiedIdentity.ci ? createLookupHash(verifiedIdentity.ci) : null;
  const diHash = verifiedIdentity.di ? createLookupHash(verifiedIdentity.di) : null;
  const duplicateIdentity = await findExistingVerifiedAccount(supabaseAdmin, stigma.id, ciHash, diHash);

  if (duplicateIdentity.error) {
    return NextResponse.json({ message: '중복 본인인증 정보를 확인하지 못했습니다.' }, { status: 500 });
  }

  if (duplicateIdentity.exists) {
    return NextResponse.json(
      {
        message: duplicateIdentity.accountEmail
          ? `이미 ${maskEmail(duplicateIdentity.accountEmail)} 계정에서 본인인증을 완료했습니다.`
          : '이미 다른 계정에서 본인인증을 완료했습니다.',
      },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();

  const { data: existingRow, error: findError } = await supabaseAdmin
    .from('chorogons')
    .select('user_id')
    .eq('user_id', stigma.id)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ message: '본인인증 정보 확인에 실패했습니다.' }, { status: 500 });
  }

  const payload = {
    provider: 'inicis',
    verification_tx_id: identityVerificationId,
    name: encrypt(verifiedIdentity.name),
    birth_date: encrypt(verifiedIdentity.birthDate),
    gender: encrypt(verifiedIdentity.gender),
    identity_verified_at: now,
    ...(ciHash ? { ci_hash: ciHash } : {}),
    ...(diHash ? { di_hash: diHash } : {}),
  };

  if (existingRow) {
    const { error } = await supabaseAdmin.from('chorogons').update(payload).eq('user_id', stigma.id);

    if (error) {
      return NextResponse.json({ message: '본인인증 정보 저장에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json(verifiedIdentity);
  }

  const { error } = await supabaseAdmin.from('chorogons').insert({
    user_id: stigma.id,
    ...payload,
  });

  if (error) {
    return NextResponse.json({ message: '본인인증 정보 저장에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({
    name: verifiedIdentity.name,
    birth_date: verifiedIdentity.birthDate,
    gender: verifiedIdentity.gender,
  });
}
