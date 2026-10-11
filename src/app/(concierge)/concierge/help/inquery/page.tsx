import { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { getCurrentStigma } from '@/lib/session/utils';
import IdentityVerificationButton from '@/components/service/common/IdentityVerificationButton';
import LoginRequiredScreen from '@/components/service/LoginRequiredScreen';
import Container from '../../menu';
import Opt, { SettlementResponse } from './opt';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = {
  title: '신고하기 - 신고센터  - 데브허브',
  description: '신고센터에서 신고하기',
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
    return null;
  }

  const data = (await response.json().catch(() => null)) as SettlementResponse | null;

  return data?.exists && data.identity ? data : null;
}

export default async function Page() {
  const cookieStore = await cookies();
  const baseUrl = await getBaseUrl();
  const cookieHeader = cookieStore.toString();
  const current = await getCurrentStigma();
  let reporter: SettlementResponse | null = null;
  if (current && baseUrl) {
    reporter = await getSettlementStatus(baseUrl, cookieHeader);
  }

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <h1>신고센터</h1>
          {!current ? <LoginRequiredScreen /> : null}
          {current && !reporter ? (
            <div className="paper">
              <IdentityVerificationButton />
            </div>
          ) : null}
          {current && reporter ? <Opt initialReporter={reporter} initialError="" /> : null}
        </div>
      </div>
    </Container>
  );
}
