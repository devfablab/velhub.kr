import { Metadata } from 'next';
import MembershipSelectors, { SelectorResponse } from '../memberships/selectors/opt';
import Container from '../menu';
import { getHubApiData } from '../shared/getHubApiData';
import styles from '@/app/hub.module.sass';

export const metadata: Metadata = {
  title: '라운지 - 마이허브 - 데브허브',
  description: '라운지 노출 관리',
};

export default async function LoungePage() {
  const result = await getHubApiData<SelectorResponse>(
    '/api/memberships/selectors',
    '라운지 노출 대상을 불러오지 못했습니다.',
  );
  return (
    <Container pageTitle="라운지" pageBack="/hub">
      <div className="container">
        <div className={`content ${styles.content} ${styles['hub-content']}`}>
          <MembershipSelectors initialData={result.data} initialError={result.error} />
        </div>
      </div>
    </Container>
  );
}
