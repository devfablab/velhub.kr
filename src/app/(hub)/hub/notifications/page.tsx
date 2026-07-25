import { Metadata } from 'next';
import Container from '../menu';
import Opt from './opt';
import styles from '@/app/hub.module.sass';

export const metadata: Metadata = {
  title: '알림내역 - 마이허브 - 데브허브',
  description: '알림내역',
};

export default function NotificationsPage() {
  return (
    <Container pageTitle="알림내역" pageBack="/hub">
      <div className="container">
        <div className={`content ${styles.content} ${styles['hub-content']}`}>
          <Opt />
        </div>
      </div>
    </Container>
  );
}
