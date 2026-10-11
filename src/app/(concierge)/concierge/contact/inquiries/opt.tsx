'use client';
import { Stack } from '@mui/material';
import {
  inquiryStatusLabels,
  inquirySubtypes,
  inquiryTypeLabels,
  type InquiryStatus,
  type InquiryType,
} from '@/lib/concierge/inquiries';
import { formatTimeAgo } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import LoginRequiredScreen from '@/components/service/LoginRequiredScreen';
import ScreenState from '@/components/service/ScreenState';
import styles from '@/app/concierge.module.sass';

type InquiryRow = {
  id: string;
  inquiry_type: InquiryType;
  status: InquiryStatus;
  title: string | null;
  created_at: string;
  inquiry_subtype: string | null;
};

export default function Opt({
  initialInquiries,
  initialError,
  initialLoginRequired,
}: {
  initialInquiries: InquiryRow[];
  initialError: string;
  initialLoginRequired: boolean;
}) {
  const inquiries = initialInquiries;
  const error = initialError;

  return (
    <div className={styles.inquiry}>
      {initialLoginRequired ? <LoginRequiredScreen /> : null}
      {!initialLoginRequired && error ? <ScreenState kind="error">{error}</ScreenState> : null}
      {!initialLoginRequired && !error && inquiries.length === 0 ? <ScreenState>문의 내역이 없습니다.</ScreenState> : null}
      {!initialLoginRequired && inquiries.length > 0 ? (
        <div className={`paper ${styles['inquiry-items']}`}>
          {inquiries.map((inquiry) => (
            <Anchor
              href={`/concierge/contact/inquiries/${inquiry.id}`}
              key={inquiry.id}
              className={`paper ${styles['inquiry-item']}`}
            >
              {inquiry.title ? <strong>{inquiry.title}</strong> : null}
              <span>
                {inquirySubtypes[inquiry.inquiry_type].find((item) => item.value === inquiry.inquiry_subtype)?.label ??
                  inquiryTypeLabels[inquiry.inquiry_type]}{' '}
                / {inquiryStatusLabels[inquiry.status]}
              </span>
              <time>{formatTimeAgo(inquiry.created_at)}</time>
            </Anchor>
          ))}
        </div>
      ) : null}
      {!initialLoginRequired ? <Stack direction="row" justifyContent="flex-end" gap={2}>
        <Anchor href="/concierge/contact" className="button medium close">
          뒤로가기
        </Anchor>
        <Anchor href="/concierge/contact/inquiries/new" className="button medium action">
          문의하기
        </Anchor>
      </Stack> : null}
    </div>
  );
}
