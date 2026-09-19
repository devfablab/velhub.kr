import { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import Container from '../menu';
import Opt, { type ReportsResponse } from './opt';
import styles from '@/app/hub.module.sass';

export const metadata: Metadata = {
  title: '신고관리 - 마이허브 - 데브허브',
  description: '내가 접수한 신고 내역',
};

export default async function ReportsPage() {
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') ?? 'http';
  let initialItems: NonNullable<ReportsResponse['items']> = [];
  let initialError = '';

  if (host) {
    try {
      const response = await fetch(`${protocol}://${host}/api/hub/reports`, {
        headers: { Cookie: (await cookies()).toString() },
        cache: 'no-store',
      });
      const result = (await response.json()) as ReportsResponse;
      if (!response.ok) throw new Error(result.error ?? '신고관리 정보를 불러오지 못했습니다.');
      initialItems = result.items ?? [];
    } catch (unknownError) {
      initialError = unknownError instanceof Error ? unknownError.message : '신고관리 정보를 불러오지 못했습니다.';
    }
  }

  return (
    <Container pageTitle="신고관리" pageBack="/hub">
      <div className="container">
        <div className={`content ${styles.content} ${styles['hub-content']}`}>
          <Opt initialItems={initialItems} initialError={initialError} />
        </div>
      </div>
    </Container>
  );
}
