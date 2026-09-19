import { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import Container from '../../../menu';
import Opt, { Inquiry } from './opt';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = { title: '문의 상세 - 데브허브', description: '데브허브 문의 상세' };

type PageProps = { params: Promise<{ inquiryId: string }> };

export default async function Page({ params }: PageProps) {
  const { inquiryId } = await params;
  let initialInquiry: Inquiry | null = null;
  let initialError = '';
  try {
    const cookieStore = await cookies();
    const headerList = await headers();
    const response = await fetch(
      `${headerList.get('x-forwarded-proto') || 'http'}://${headerList.get('host')}/api/concierge/contact/inquiries/${inquiryId}`,
      {
        headers: { cookie: cookieStore.toString() },
        cache: 'no-store',
      },
    );
    const result = (await response.json()) as { inquiry?: Inquiry; error?: string };
    if (!response.ok || !result.inquiry) throw new Error(result.error ?? '문의를 불러오지 못했습니다.');
    initialInquiry = result.inquiry;
  } catch (error) {
    initialError = error instanceof Error ? error.message : '문의를 불러오지 못했습니다.';
  }
  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <h1>문의 상세</h1>
          <Opt initialInquiry={initialInquiry} initialError={initialError} />
        </div>
      </div>
    </Container>
  );
}
