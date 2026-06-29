import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { normalizeText } from '@/lib/utils';
import IdentityVerificationButton from '@/components/service/common/IdentityVerificationButton';
import Container from '../../menu';
import Opt from './opt';
import styles from '@/app/manage.module.sass';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

type Identity = {
  name: string;
  birth_date: string;
  gender: string;
  identity_verified_at: string;
};

type IdentityStatusResponse = {
  exists: boolean;
  identity: Identity | null;
};

type SettlementResponse = {
  exists: boolean;
  settlement: {
    settlement_type: 'individual' | 'business';
  } | null;
};

function onlyDigits(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '');
}

function isAdult(birthDate: string | null | undefined) {
  const digits = onlyDigits(birthDate);

  if (digits.length !== 8) {
    return false;
  }

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const today = new Date();
  const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
  let age = today.getFullYear() - year;

  if (today < birthdayThisYear) {
    age -= 1;
  }

  return age >= 19;
}

async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') ?? 'http';

  if (!host) {
    return null;
  }

  return `${protocol}://${host}`;
}

async function getIdentityStatus(baseUrl: string, cookieHeader: string) {
  const response = await fetch(`${baseUrl}/api/identity/portone/status`, {
    method: 'GET',
    headers: {
      Cookie: cookieHeader,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json().catch(() => null)) as IdentityStatusResponse | null;
}

async function getSettlementStatus(baseUrl: string, cookieHeader: string) {
  const response = await fetch(`${baseUrl}/api/settlement`, {
    method: 'GET',
    headers: {
      Cookie: cookieHeader,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return false;
  }

  const data = (await response.json().catch(() => null)) as SettlementResponse | null;

  return Boolean(data?.exists && data.settlement);
}

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const cookieStore = await cookies();
  if (!normalizedSiteName) {
    notFound();
  }
  const baseUrl = await getBaseUrl();
  const cookieHeader = cookieStore.toString();

  let hasSettlement = false;
  let isMinor = false;

  if (baseUrl) {
    const identityStatus = await getIdentityStatus(baseUrl, cookieHeader);
    const identity = identityStatus?.exists ? identityStatus.identity : null;

    hasSettlement = await getSettlementStatus(baseUrl, cookieHeader);

    if (identity) {
      isMinor = !isAdult(identity.birth_date);
    }
  }

  return (
    <Container pageTitle="결제 관리" pageBack={`/${siteName}/manage`} menu="payments">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {(!hasSettlement && !isMinor) || isMinor ? (
            <div className="paper">
              {!hasSettlement && !isMinor ? <IdentityVerificationButton /> : null}
              {isMinor ? (
                <p className="alert warning">
                  <WarningAmberRoundedIcon />
                  <span>만 19세 미만은 본 사이트에서 수익창출을 하실 수 없습니다.</span>
                </p>
              ) : null}
            </div>
          ) : null}
          {hasSettlement ? <Opt /> : null}
        </div>
      </div>
    </Container>
  );
}
