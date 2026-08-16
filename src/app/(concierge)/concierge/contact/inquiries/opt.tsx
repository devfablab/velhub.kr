'use client';

import { useEffect, useState } from 'react';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { Box, Stack, Typography } from '@mui/material';
import { inquirySubtypes, inquiryTypeLabels, type InquiryType } from '@/lib/concierge/inquiries';
import Anchor from '@/components/Anchor';

type InquiryRow = {
  id: string;
  inquiry_type: InquiryType;
  status: string;
  title: string;
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
    <Stack gap={3}>
      <div className="paper">
        <Stack gap={1.5}>
          {error ? (
            <p className="alert error">
              <ErrorOutlineRoundedIcon />
              <span>{error}</span>
            </p>
          ) : null}
          {!error && inquiries.length === 0 ? <Typography variant="body2">문의 내역이 없습니다.</Typography> : null}
          {inquiries.map((inquiry) => (
            <Box key={inquiry.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
              <Anchor href={`/concierge/contact/inquiries/${inquiry.id}`}>{inquiry.title}</Anchor>
              <Typography variant="body2">
                {inquirySubtypes[inquiry.inquiry_type].find((item) => item.value === inquiry.inquiry_subtype)?.label ??
                  inquiryTypeLabels[inquiry.inquiry_type]}{' '}
                / {inquiry.status} / {new Date(inquiry.created_at).toLocaleDateString('ko-KR')}
              </Typography>
            </Box>
          ))}
        </Stack>
      </div>
      <Stack direction="row" justifyContent="flex-end" gap={2}>
        <Anchor href="/concierge/contact" className="button medium close">
          뒤로가기
        </Anchor>
        <Anchor href="/concierge/contact/inquiries/new" className="button medium action">
          문의하기
        </Anchor>
      </Stack>
    </Stack>
  );
}
