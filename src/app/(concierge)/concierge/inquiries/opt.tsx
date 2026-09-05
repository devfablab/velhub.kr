'use client';

import { useEffect, useState } from 'react';
import { Tab, Tabs } from '@mui/material';
import {
  inquiryStatusLabels,
  inquirySubtypes,
  inquiryTypeLabels,
  inquiryTypes,
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
  resolution_code: string | null;
  inquiry_subtype: string | null;
  requesterActivityName: string;
};

export default function Opt() {
  const [type, setType] = useState<InquiryType>('service_question');
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch(`/api/concierge/inquiries?type=${type}`, { cache: 'no-store' });
      const result = (await response.json().catch(() => null)) as { inquiries?: InquiryRow[]; error?: string } | null;
      if (cancelled) return;
      if (!response.ok) {
        setError(result?.error ?? '문의 내역을 불러오지 못했습니다.');
        return;
      }
      setError('');
      setInquiries(result?.inquiries ?? []);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [type]);

  return (
    <div className={styles.inquiry}>
      <Tabs value={type} onChange={(_, value: InquiryType) => setType(value)} variant="scrollable" scrollButtons="auto">
        {inquiryTypes.map((value) => (
          <Tab key={value} value={value} label={inquiryTypeLabels[value]} />
        ))}
      </Tabs>
      {error ? <ScreenState kind="error">{error}</ScreenState> : null}
      {!error && inquiries.length === 0 ? <ScreenState>문의가 없습니다.</ScreenState> : null}
      {inquiries.length > 0 ? (
        <div className={`paper ${styles['inquiry-items']}`}>
          {inquiries.map((inquiry) => (
            <Anchor
              href={`/concierge/inquiries/${inquiry.id}`}
              key={inquiry.id}
              className={`paper ${styles['inquiry-item']}`}
            >
              {inquiry.title ? <strong>{inquiry.title}</strong> : null}
              <span>{inquiry.requesterActivityName} 님</span>
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
    </div>
  );
}
