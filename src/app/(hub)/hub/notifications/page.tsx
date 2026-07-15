import Container from '../menu';
import Opt from './opt';
import styles from '@/app/hub.module.sass';

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
