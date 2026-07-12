import { headers, cookies } from 'next/headers';

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

async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') ?? 'http';

  if (!host) {
    return process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null;
  }

  return `${protocol}://${host}`;
}

export async function detectAdult(siteName: string): Promise<boolean> {
  const baseUrl = await getBaseUrl();

  if (!baseUrl || !siteName) {
    return false;
  }

  const cookieStore = await cookies();

  const [identityResponse, siteResponse] = await Promise.all([
    fetch(`${baseUrl}/api/identity/portone/status`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        Cookie: cookieStore.toString(),
      },
      cache: 'no-store',
    }),
    fetch(`${baseUrl}/api/site/public?siteName=${encodeURIComponent(siteName)}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    }),
  ]);

  if (!identityResponse.ok || !siteResponse.ok) {
    return false;
  }

  const [identityResult, siteResult] = await Promise.all([
    identityResponse.json().catch(() => null) as Promise<IdentityStatusResponse | null>,
    siteResponse.json().catch(() => null) as Promise<SitePublicResponse | null>,
  ]);

  if (
    !identityResult ||
    !identityResult.exists ||
    !identityResult.identity?.birth_date ||
    siteResult?.siteInfo?.purchase_available !== true
  ) {
    return false;
  }

  const birthDate = identityResult.identity.birth_date;

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
