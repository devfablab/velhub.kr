import { Metadata } from 'next';
import Container from '../menu';
import Opt from './opt';
import styles from '@/app/hub.module.sass';

export const metadata: Metadata = {
  title: '신고 내역 - 마이허브 - 데브허브',
  description: '내가 접수한 신고 내역',
};

export default function ReportsPage() {
  return (
    <Container pageTitle="신고 내역" pageBack="/hub">
      <div className="container">
        <div className={`content ${styles.content} ${styles['hub-content']}`}>
          <Opt />
        </div>
      </div>
    </Container>
  );
}
