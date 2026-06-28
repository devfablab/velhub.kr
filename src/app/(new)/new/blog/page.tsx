import { cookies, headers } from 'next/headers';
import IdentityVerificationButton from '@/components/service/common/IdentityVerificationButton';
import Opt from './opt';
import styles from '@/app/new.module.sass';

type SettlementResponse = {
  exists: boolean;
  settlement: {
    settlement_type: 'individual' | 'business';
  } | null;
};

async function getSettlementStatus() {
  const headersList = await headers();
  const cookieStore = await cookies();

  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') ?? 'http';

  if (!host) {
    return false;
  }

  const response = await fetch(`${protocol}://${host}/api/settlement`, {
    method: 'GET',
    headers: {
      Cookie: cookieStore.toString(),
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
  const hasSettlement = await getSettlementStatus();

  return (
    <main className={styles['new-generation']}>
      <div className={styles.container}>
        <div className={`content ${styles.content}`}>
          <h1>블로그 개설</h1>

          {!hasSettlement ? (
            <div className="paper">
              <IdentityVerificationButton />
            </div>
          ) : null}

          {hasSettlement ? <Opt /> : null}
        </div>
      </div>
    </main>
  );
}
