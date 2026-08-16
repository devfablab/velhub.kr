'use client';

import { useEffect, useState } from 'react';
import { Box, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import { inquiryTypeLabels, inquiryTypes, type InquiryType } from '@/lib/concierge/inquiries';

type InquiryRow = {
  id: string;
  inquiry_type: InquiryType;
  status: string;
  title: string;
  created_at: string;
  resolution_code: string | null;
};

export default function Opt() {
  const [type, setType] = useState<InquiryType>('minor_purchase_cancellation');
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
    <Paper sx={{ p: { xs: 1, sm: 2 } }}>
      <Tabs value={type} onChange={(_, value: InquiryType) => setType(value)} variant="scrollable" scrollButtons="auto">
        {inquiryTypes.map((value) => (
          <Tab key={value} value={value} label={inquiryTypeLabels[value]} />
        ))}
      </Tabs>
      <Box sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          {error ? <Typography color="error">{error}</Typography> : null}
          {!error && inquiries.length === 0 ? <Typography color="text.secondary">문의가 없습니다.</Typography> : null}
          {inquiries.map((inquiry) => (
            <Box key={inquiry.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
              <Typography fontWeight={700}>{inquiry.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {inquiry.status} · {new Date(inquiry.created_at).toLocaleString('ko-KR')}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    </Paper>
  );
}
