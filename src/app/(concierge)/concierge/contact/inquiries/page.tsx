import { Metadata } from 'next';
import type { InquiryStatus, InquiryType } from '@/lib/service/concierge/conciergeInquiries';
import { fetchApiRoute } from '@/lib/service/site/siteApiRoutes';
import { getCurrentStigma } from '@/lib/session/utils';
import Container from '../../menu';
import Opt from './opt';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = {
  title: '문의 내역 - 데브허브',
  description: '데브허브 문의 내역',
};

type InquiryRow = {
  id: string;
  inquiry_type: InquiryType;
  status: InquiryStatus;
  title: string | null;
  created_at: string;
  inquiry_subtype: string | null;
};

export default async function Page() {
  let initialInquiries: InquiryRow[] = [];
  let initialError = '';
  const current = await getCurrentStigma();

  if (current) {
    try {
      const response = await fetchApiRoute('/api/concierge/contact/inquiries');
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
          <Opt initialInquiries={initialInquiries} initialError={initialError} initialLoginRequired={!current} />
        </div>
      </div>
    </Container>
  );
}
