import { Metadata } from 'next';
import { fetchApiRoute } from '@/lib/service/site/siteApiRoutes';
import { getCurrentStigma } from '@/lib/session/utils';
import IdentityVerificationButton from '@/components/buttons/IdentityVerificationButton';
import LoginRequiredScreen from '@/components/service/LoginRequiredScreen';
import Container from '../../menu';
import Opt, { SettlementResponse } from './opt';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = {
  title: '신고하기 - 권리보호센터 - 데브허브',
  description: '권리보호센터에서 신고하기',
};

async function getSettlementStatus() {
  const response = await fetchApiRoute('/api/settlement');

  if (!response.ok) {
    return null;
  }

  const data = (await response.json().catch(() => null)) as SettlementResponse | null;

  return data?.exists && data.identity ? data : null;
}

export default async function Page() {
  const current = await getCurrentStigma();
  let reporter: SettlementResponse | null = null;
  if (current) {
    reporter = await getSettlementStatus();
  }

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <h1>권리보호센터</h1>
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
