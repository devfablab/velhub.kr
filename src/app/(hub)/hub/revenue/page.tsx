import { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import Container from '../menu';
import RevenueHub, { RevenueSitesResponse } from './opt';

export const metadata: Metadata = {
  title: '수입/정산 - 마이허브 - 데브허브',
  description: '수입/정산',
};

export default async function Page() {
  let initialData: RevenueSitesResponse | null = null;
  let initialError = '';

  try {
    const cookieStore = await cookies();
    const headerList = await headers();
    const host = headerList.get('host');
    const protocol = headerList.get('x-forwarded-proto') || 'http';
    const response = await fetch(`${protocol}://${host}/api/hub/revenue/sites`, {
      headers: { cookie: cookieStore.toString() },
      cache: 'no-store',
    });
    const result = (await response.json()) as RevenueSitesResponse;
    if (!response.ok) throw new Error(result.error || '수입/정산 사이트를 불러오지 못했습니다.');
    initialData = result;
  } catch (error) {
    initialError = error instanceof Error ? error.message : '수입/정산 사이트를 불러오지 못했습니다.';
  }

  return (
    <Container pageTitle="수입/정산" pageBack="/hub">
      <RevenueHub initialData={initialData} initialError={initialError} />
    </Container>
  );
}
