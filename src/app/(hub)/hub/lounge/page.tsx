import { Metadata } from 'next';
import Container from '../menu';
import MembershipSelectors from '../memberships/selectors/opt';
import styles from '@/app/hub.module.sass';

export const metadata: Metadata = {
  title: '라운지 - 마이허브 - 데브허브',
  description: '라운지 노출 관리',
};

export default function LoungePage() {
  return (
    <Container pageTitle="라운지" pageBack="/hub">
      <div className="container">
        <div className={`content ${styles.content} ${styles['hub-content']}`}>
          <MembershipSelectors />
        </div>
      </div>
    </Container>
  );
}
