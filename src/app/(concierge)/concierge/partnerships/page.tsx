import { Metadata } from 'next';
import { getPartnershipProposals } from '@/lib/partnerships/server';
import Container from '../menu';
import Opt from './opt';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = { title: '제휴 제안 - 데브허브', description: '데브허브 제휴 제안 내역' };

export default async function Page() {
  const { proposals, error } = await getPartnershipProposals();

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles.minimal}`}>
          <h1>제휴 제안</h1>
          <Opt initialProposals={proposals} initialError={error} />
        </div>
      </div>
    </Container>
  );
}
