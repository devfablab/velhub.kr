import { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ConciergeReportItem } from '@/lib/reports/concierge';
import { loadConciergeReports } from '@/lib/reports/conciergeServer';
import verifySession from '@/lib/session/verifySession';
import Container from '../menu';
import Opt from './opt';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = {
  title: '신고내역보기',
  description: '신고내역보기',
};

export default async function Page() {
  const session = await verifySession({ siteId: null });

  if (session.case !== 'admin') {
    notFound();
  }

  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') ?? 'http';
  const origin = host ? `${protocol}://${host}` : 'http://localhost:3006';
  let initialReports: ConciergeReportItem[] = [];
  let initialTotal = 0;
  let initialError = '';

  try {
    const result = await loadConciergeReports({
      reportType: null,
      targetType: null,
      reporterUserId: null,
      page: 0,
      pageSize: 50,
      origin,
    });
    initialReports = result.items;
    initialTotal = result.total;
  } catch (unknownError) {
    initialError = unknownError instanceof Error ? unknownError.message : '신고 목록을 불러오지 못했습니다.';
  }

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <h1>신고 내역</h1>
          <Opt initialReports={initialReports} initialTotal={initialTotal} initialError={initialError} />
        </div>
      </div>
    </Container>
  );
}
