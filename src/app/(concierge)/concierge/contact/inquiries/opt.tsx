'use client';

import { useEffect, useState } from 'react';
import { Stack } from '@mui/material';
import {
  inquiryStatusLabels,
  inquirySubtypes,
  inquiryTypeLabels,
  type InquiryStatus,
  type InquiryType,
} from '@/lib/concierge/inquiries';
import Anchor from '@/components/Anchor';
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

export default function Opt() {
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const response = await fetch('/api/concierge/contact/inquiries', { cache: 'no-store' });
      const result = (await response.json().catch(() => null)) as {
        inquiries?: InquiryRow[];
        error?: string;
      } | null;

      if (!response.ok) {
        setError(result?.error ?? '문의 내역을 불러오지 못했습니다.');
        return;
      }

      setInquiries(result?.inquiries ?? []);
    }

    void load();
  }, []);

  return (
    <div className={styles.inquiry}>
      {error ? (
        <ScreenState kind="error">{error}</ScreenState>
      ) : null}
      {!error && inquiries.length === 0 ? (
        <ScreenState>문의 내역이 없습니다.</ScreenState>
      ) : null}
      {inquiries.length > 0 ? (
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
              <time>{new Date(inquiry.created_at).toLocaleDateString('ko-KR')}</time>
            </Anchor>
          ))}
        </div>
      ) : null}
      <Stack direction="row" justifyContent="flex-end" gap={2}>
        <Anchor href="/concierge/contact" className="button medium close">
          뒤로가기
        </Anchor>
        <Anchor href="/concierge/contact/inquiries/new" className="button medium action">
          문의하기
        </Anchor>
      </Stack>
    </div>
  );
}
