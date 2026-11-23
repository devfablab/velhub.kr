import { Metadata } from 'next';
import { fetchApiRoute } from '@/lib/service/site/siteApiRoutes';
import Container from '../menu';
import Opt, { type NotificationsResponse } from './opt';
import styles from '@/app/hub.module.sass';

export const metadata: Metadata = {
  title: '알림 - 마이허브 - 데브허브',
  description: '알림',
};

export default async function NotificationsPage() {
  let initialItems: NonNullable<NotificationsResponse['items']> = [];
  let initialError = '';

  try {
    const response = await fetchApiRoute('/api/notifications');
    const result = (await response.json()) as NotificationsResponse;
    if (!response.ok) throw new Error(result.error ?? '알림을 불러오지 못했습니다.');
    initialItems = result.items ?? [];
  } catch (unknownError) {
    initialError = unknownError instanceof Error ? unknownError.message : '알림을 불러오지 못했습니다.';
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
