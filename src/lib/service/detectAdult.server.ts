import { getSiteApiData } from '@/lib/service/site/getSiteApiData';

export type IdentityStatusResponse = {
  exists: boolean;
  identity: {
    birth_date: string;
  } | null;
};

export type SitePublicResponse = {
  siteInfo?: {
    purchase_available?: boolean;
  };
};

type ApiResult<T> = { data: T | null; error: string };

export function isAdultForSite(
  identityResult: ApiResult<IdentityStatusResponse>,
  siteResult: ApiResult<SitePublicResponse>,
): boolean {
  if (identityResult.error || siteResult.error) {
    return false;
  }

  const identity = identityResult.data;

  if (
    !identity ||
    !identity.exists ||
    !identity.identity?.birth_date ||
    siteResult.data?.siteInfo?.purchase_available !== true
  ) {
    return false;
  }

  const birthDate = identity.identity.birth_date;

  if (!/^\d{8}$/.test(birthDate)) {
    return false;
  }

  const birthYear = Number(birthDate.slice(0, 4));
  const birthMonth = Number(birthDate.slice(4, 6));
  const birthDay = Number(birthDate.slice(6, 8));

  const today = new Date();
  const adultDate = new Date(birthYear + 19, birthMonth - 1, birthDay);

  return today >= adultDate;
}

export async function detectAdult(siteName: string): Promise<boolean> {
  if (!siteName) {
    return false;
  }

  const [identityResult, siteResult] = await Promise.all([
    getSiteApiData<IdentityStatusResponse>('/api/identity/portone/status', '본인인증 정보를 불러오지 못했습니다.'),
    getSiteApiData<SitePublicResponse>(`/api/site/public?siteName=${siteName}`, '사이트 정보를 불러오지 못했습니다.'),
  ]);

  return isAdultForSite(identityResult, siteResult);
}
