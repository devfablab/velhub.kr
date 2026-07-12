type IdentityStatusResponse = {
  exists: boolean;
  identity: {
    birth_date: string;
  } | null;
};

type SitePublicResponse = {
  siteInfo?: {
    purchase_available?: boolean;
  };
};

export async function detectAdult(siteName: string) {
  const [identityResponse, siteResponse] = await Promise.all([
    fetch('/api/identity/portone/status', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    }),
    fetch(`/api/site/public?siteName=${encodeURIComponent(siteName)}`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    }),
  ]);

  if (!identityResponse.ok || !siteResponse.ok) {
    return false;
  }

  const [identityResult, siteResult] = await Promise.all([
    identityResponse.json() as Promise<IdentityStatusResponse>,
    siteResponse.json() as Promise<SitePublicResponse>,
  ]);

  if (
    !identityResult.exists ||
    !identityResult.identity?.birth_date ||
    siteResult.siteInfo?.purchase_available !== true
  ) {
    return false;
  }

  const birthDate = identityResult.identity.birth_date;

  const birthYear = Number(birthDate.slice(0, 4));
  const birthMonth = Number(birthDate.slice(4, 6));
  const birthDay = Number(birthDate.slice(6, 8));

  const today = new Date();
  const adultDate = new Date(birthYear + 19, birthMonth - 1, birthDay);

  return today >= adultDate;
}
