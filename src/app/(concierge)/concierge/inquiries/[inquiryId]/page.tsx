import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import verifySession from '@/lib/session/verifySession';
import Container from '../../menu';
import Opt from './opt';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = { title: '문의 처리 - 데브허브', description: '관리자 문의 처리' };

export default async function Page() {
  const session = await verifySession({ siteId: null });

  if (session.case !== 'admin') {
    notFound();
  }

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <h1>문의 처리</h1>
          <Opt />
        </div>
      </div>
    </Container>
  );
}
