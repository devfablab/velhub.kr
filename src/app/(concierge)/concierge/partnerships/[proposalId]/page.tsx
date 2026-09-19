import { Metadata } from 'next';
import { getPartnershipProposal } from '@/lib/partnerships/server';
import Container from '../../menu';
import Opt from './opt';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = { title: '제휴 제안 상세 - 데브허브', description: '데브허브 제휴 제안 상세' };

export default async function Page({ params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  const { proposal, error } = await getPartnershipProposal(proposalId);

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles.minimal}`}>
          <h1>제휴 제안 보기</h1>
          <Opt proposalId={proposalId} initialProposal={proposal} initialError={error} />
        </div>
      </div>
    </Container>
  );
}
