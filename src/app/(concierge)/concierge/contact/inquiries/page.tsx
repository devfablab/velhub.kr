import { Metadata } from 'next';
import Container from '../../menu';
import Opt from './opt';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = {
  title: '문의하기 - 데브허브',
  description: '데브허브 문의 접수와 문의 내역',
};

export default function Page() {
  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <h1>문의하기</h1>
          <Opt />
        </div>
      </div>
    </Container>
  );
}
