'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Alert, Box, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import {
  inquiryResolutionLabels,
  inquiryTypeLabels,
  type InquiryResolutionCode,
  type InquiryType,
} from '@/lib/concierge/inquiries';

type Inquiry = {
  id: string;
  requester_stigma_id: string;
  inquiry_type: InquiryType;
  status: 'received' | 'reviewing' | 'info_requested' | 'closed';
  title: string;
  content: string;
  created_at: string;
  resolution_code: InquiryResolutionCode | null;
  resolution_summary: string | null;
  inquiry_orders: { payment_id: string }[];
};

const statusLabels = { received: '접수됨', reviewing: '검토 중', info_requested: '추가 정보 요청', closed: '종결' };

function resolutionOptions(type: InquiryType) {
  const common = ['request_withdrawn', 'additional_information_not_submitted'] as InquiryResolutionCode[];
  if (type === 'minor_purchase_cancellation')
    return [
      ...common,
      'minor_cancellation_approved_payment_cancelled',
      'minor_cancellation_not_eligible',
      'parent_relationship_unverified',
    ] as InquiryResolutionCode[];
  return [...common, 'error_resolved_guidance_completed'] as InquiryResolutionCode[];
}

export default function Opt() {
  const params = useParams<{ inquiryId: string }>();
  const router = useRouter();
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [status, setStatus] = useState<Inquiry['status']>('received');
  const [resolutionCode, setResolutionCode] = useState<InquiryResolutionCode>('error_resolved_guidance_completed');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/concierge/inquiries/${params.inquiryId}`, { cache: 'no-store' });
      const result = (await response.json().catch(() => null)) as { inquiry?: Inquiry; error?: string } | null;
      if (!response.ok || !result?.inquiry) {
        setError(result?.error ?? '문의를 불러오지 못했습니다.');
        return;
      }
      setInquiry(result.inquiry);
      setStatus(result.inquiry.status);
      setSummary(result.inquiry.resolution_summary ?? '');
      setResolutionCode(result.inquiry.resolution_code ?? resolutionOptions(result.inquiry.inquiry_type)[0]);
    }
    void load();
  }, [params.inquiryId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      const response = await fetch(`/api/concierge/inquiries/${params.inquiryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          resolutionCode: status === 'closed' ? resolutionCode : undefined,
          resolutionSummary: status === 'closed' ? summary : undefined,
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? '문의 상태를 저장하지 못했습니다.');
      router.refresh();
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : '문의 상태를 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  if (error && !inquiry) return <Alert severity="error">{error}</Alert>;
  if (!inquiry) return null;
  const options = resolutionOptions(inquiry.inquiry_type);
  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={1}>
          <Typography variant="overline">{inquiryTypeLabels[inquiry.inquiry_type]}</Typography>
          <Typography variant="h5" fontWeight={700}>
            {inquiry.title}
          </Typography>
          <Typography whiteSpace="pre-wrap">{inquiry.content}</Typography>
          {inquiry.inquiry_orders[0] ? (
            <Typography variant="body2">연결 결제 ID: {inquiry.inquiry_orders[0].payment_id}</Typography>
          ) : null}
        </Stack>
      </Paper>
      <Paper component="form" onSubmit={save} sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2}>
          <Typography variant="h6" fontWeight={700}>
            처리
          </Typography>
          <TextField
            select
            label="문의 상태"
            value={status}
            onChange={(event) => setStatus(event.target.value as Inquiry['status'])}
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          {status === 'closed' ? (
            <>
              <TextField
                select
                label="종결 결과"
                value={resolutionCode}
                onChange={(event) => setResolutionCode(event.target.value as InquiryResolutionCode)}
              >
                {options.map((value) => (
                  <MenuItem key={value} value={value}>
                    {inquiryResolutionLabels[value]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                required
                multiline
                minRows={4}
                label="계정주 안내 내용"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </>
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Box>
            <Button type="submit" variant="contained" disabled={isSaving}>
              {isSaving ? '저장 중' : '저장'}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}
