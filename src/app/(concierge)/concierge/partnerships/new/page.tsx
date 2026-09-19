import { Metadata } from 'next';
import { getPartnershipFormInfo } from '@/lib/partnerships/server';
import Container from '../../menu';
import Opt from './opt';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = { title: '제휴 제안하기 - 데브허브', description: '데브허브 제휴 제안 접수' };

export default async function Page() {
  const formInfo = await getPartnershipFormInfo();

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles.minimal}`}>
          <h1>제휴 제안하기</h1>
          <Opt formInfo={formInfo} />
        </div>
      </div>
    </Container>
  );
}
