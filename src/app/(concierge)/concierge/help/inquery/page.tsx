import { cookies, headers } from 'next/headers';
import IdentityVerificationButton from '@/components/service/common/IdentityVerificationButton';
import Container from '../../menu';
import styles from '@/app/concierge.module.sass';
import Opt from './opt';

type SettlementResponse = {
  exists: boolean;
  settlement: {
    settlement_type: 'individual' | 'business';
  } | null;
};

async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') ?? 'http';

  if (!host) {
    return null;
  }

  return `${protocol}://${host}`;
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

export default async function Page() {
  const cookieStore = await cookies();
  const baseUrl = await getBaseUrl();
  const cookieHeader = cookieStore.toString();
  let hasSettlement = false;
  if (baseUrl) {
    hasSettlement = await getSettlementStatus(baseUrl, cookieHeader);
  }

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <h1>권리보호센터</h1>
          {/* {!hasSettlement ? ( */}
          <div className="paper">
            <IdentityVerificationButton />
          </div>
          {/* ) : null} */}
          {hasSettlement ? <Opt /> : null}
        </div>
      </div>
    </Container>
  );
}
