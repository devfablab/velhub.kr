import { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import verifySession from '@/lib/session/verifySession';
import Container from '../../menu';
import Opt, { InquiryDetailResponse } from './opt';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = { title: '문의 처리 - 데브허브', description: '관리자 문의 처리' };

type PageProps = { params: Promise<{ inquiryId: string }> };

export default async function Page({ params }: PageProps) {
  const session = await verifySession({ siteId: null });

  if (session.case !== 'admin') {
    notFound();
  }
  const { inquiryId } = await params;
  let initialData: InquiryDetailResponse | null = null;
  let initialError = '';
  try {
    const cookieStore = await cookies();
    const headerList = await headers();
    const response = await fetch(
      `${headerList.get('x-forwarded-proto') || 'http'}://${headerList.get('host')}/api/concierge/inquiries/${inquiryId}`,
      {
        headers: { cookie: cookieStore.toString() },
        cache: 'no-store',
      },
    );
    const result = (await response.json()) as InquiryDetailResponse;
    if (!response.ok || !result.inquiry) throw new Error(result.error ?? '문의를 불러오지 못했습니다.');
    initialData = result;
  } catch (error) {
    initialError = error instanceof Error ? error.message : '문의를 불러오지 못했습니다.';
  }

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <h1>문의 처리</h1>
          <Opt initialData={initialData} initialError={initialError} />
        </div>
      </div>
    </Container>
  );
}
