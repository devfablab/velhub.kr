import { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { inquiryTypes, type InquiryStatus, type InquiryType } from '@/lib/concierge/inquiries';
import verifySession from '@/lib/session/verifySession';
import Container from '../menu';
import Opt from './opt';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = { title: '문의 내역 - 데브허브', description: '관리자 문의 내역' };

type InquiryRow = {
  id: string;
  inquiry_type: InquiryType;
  status: InquiryStatus;
  title: string | null;
  created_at: string;
  resolution_code: string | null;
  inquiry_subtype: string | null;
  requesterActivityName: string;
};

export default async function Page() {
  const session = await verifySession({ siteId: null });

  if (session.case !== 'admin') {
    notFound();
  }

  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') ?? 'http';
  const initialType = inquiryTypes[0];
  let initialInquiries: InquiryRow[] = [];
  let initialError = '';

  if (host) {
    try {
      const response = await fetch(`${protocol}://${host}/api/concierge/inquiries?type=${initialType}`, {
        headers: { Cookie: (await cookies()).toString() },
        cache: 'no-store',
      });
      const result = (await response.json().catch(() => null)) as { inquiries?: InquiryRow[]; error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? '문의 내역을 불러오지 못했습니다.');
      initialInquiries = result?.inquiries ?? [];
    } catch (unknownError) {
      initialError = unknownError instanceof Error ? unknownError.message : '문의 내역을 불러오지 못했습니다.';
    }
  }

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <h1>문의 내역</h1>
          <Opt initialInquiries={initialInquiries} initialError={initialError} />
        </div>
      </div>
    </Container>
  );
}
