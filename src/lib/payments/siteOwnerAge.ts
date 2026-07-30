import { decrypt } from '@/lib/encryption/decrypt';
import { getSupabaseAdmin } from '@/lib/supabase';

type SiteOwnerAgeStatus = {
  isMinor: boolean;
  canRegisterBillingMethod: boolean;
  adultBillingAt: Date | null;
  isFormerMinorSite: boolean;
};

function getBirthDigits(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '');
}

export function getAdultBillingAt(birthDate: string | null | undefined) {
  const digits = getBirthDigits(birthDate);

  if (digits.length !== 8) {
    return null;
  }

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  return new Date(year + 19, month - 1, day);
}

export function getSiteOwnerAgeStatusFromBirthDate({
  birthDate,
  siteCreatedAt,
  now = new Date(),
}: {
  birthDate: string | null | undefined;
  siteCreatedAt?: string | null;
  now?: Date;
}): SiteOwnerAgeStatus {
  const adultBillingAt = getAdultBillingAt(birthDate);

  if (!adultBillingAt) {
    return {
      isMinor: false,
      canRegisterBillingMethod: true,
      adultBillingAt: null,
      isFormerMinorSite: false,
    };
  }

  const adultBillingAtTime = adultBillingAt.getTime();
  const isMinor = now.getTime() < adultBillingAtTime;
  const billingMethodAvailableAt = new Date(adultBillingAt);
  billingMethodAvailableAt.setDate(billingMethodAvailableAt.getDate() - 7);
  const siteCreatedAtTime = siteCreatedAt ? new Date(siteCreatedAt).getTime() : Number.NaN;

  return {
    isMinor,
    canRegisterBillingMethod: now.getTime() >= billingMethodAvailableAt.getTime(),
    adultBillingAt,
    isFormerMinorSite:
      now.getTime() >= adultBillingAtTime &&
      Number.isFinite(siteCreatedAtTime) &&
      siteCreatedAtTime < adultBillingAtTime,
  };
}

export async function getSiteOwnerAgeStatus({
  ownerStigmaId,
  siteCreatedAt,
  now,
}: {
  ownerStigmaId: string | null | undefined;
  siteCreatedAt?: string | null;
  now?: Date;
}) {
  if (!ownerStigmaId) {
    return getSiteOwnerAgeStatusFromBirthDate({ birthDate: null, siteCreatedAt, now });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const chorogonResult = await supabaseAdmin
    .from('chorogons')
    .select('birth_date, birth_date_dummy, identity_verified_at')
    .eq('user_id', ownerStigmaId)
    .maybeSingle();

  if (chorogonResult.error) {
    throw new Error('운영자 본인인증 정보를 확인하지 못했습니다.');
  }

  const chorogon = chorogonResult.data;
  const birthDate =
    chorogon?.identity_verified_at && chorogon.birth_date
      ? process.env.NEXT_PUBLIC_APP_ENV === 'test' && chorogon.birth_date_dummy
        ? chorogon.birth_date_dummy
        : decrypt(String(chorogon.birth_date))
      : null;

  return getSiteOwnerAgeStatusFromBirthDate({ birthDate, siteCreatedAt, now });
}
