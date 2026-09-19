import { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import Container from '../menu';
import Opt, { type NotificationsResponse } from './opt';
import styles from '@/app/hub.module.sass';

export const metadata: Metadata = {
  title: '알림 - 마이허브 - 데브허브',
  description: '알림',
};

export default async function NotificationsPage() {
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') ?? 'http';
  let initialItems: NonNullable<NotificationsResponse['items']> = [];
  let initialError = '';

  if (host) {
    try {
      const response = await fetch(`${protocol}://${host}/api/notifications`, {
        headers: { Cookie: (await cookies()).toString() },
        cache: 'no-store',
      });
      const result = (await response.json()) as NotificationsResponse;
      if (!response.ok) throw new Error(result.error ?? '알림을 불러오지 못했습니다.');
      initialItems = result.items ?? [];
    } catch (unknownError) {
      initialError = unknownError instanceof Error ? unknownError.message : '알림을 불러오지 못했습니다.';
    }
  }

  return (
    <Container pageTitle="알림" pageBack="/hub">
      <div className="container">
        <div className={`content ${styles.content} ${styles['hub-content']}`}>
          <Opt initialItems={initialItems} initialError={initialError} />
        </div>
      </div>
    </Container>
  );
}
