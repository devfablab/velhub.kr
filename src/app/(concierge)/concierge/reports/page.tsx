import { notFound } from 'next/navigation';
import verifySession from '@/lib/session/verifySession';
import Container from '../menu';
import Opt from './opt';
import styles from '@/app/concierge.module.sass';

export default async function Page() {
  const session = await verifySession({ siteId: null });

  if (session.case !== 'admin') {
    notFound();
  }

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <h1>신고 내역</h1>
          <Opt />
        </div>
      </div>
    </Container>
  );
}
