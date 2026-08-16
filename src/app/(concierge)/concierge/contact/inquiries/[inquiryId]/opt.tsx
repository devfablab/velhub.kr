'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import {
  inquiryResolutionLabels,
  inquiryTypeLabels,
  type InquiryResolutionCode,
  type InquiryType,
} from '@/lib/concierge/inquiries';

type Inquiry = {
  inquiry_type: InquiryType;
  status: string;
  title: string;
  content: string;
  resolution_code: InquiryResolutionCode | null;
  resolution_summary: string | null;
};

export default function Opt() {
  const { inquiryId } = useParams<{ inquiryId: string }>();
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);

  async function load() {
    const response = await fetch(`/api/concierge/contact/inquiries/${inquiryId}`, { cache: 'no-store' });
    const result = (await response.json().catch(() => null)) as { inquiry?: Inquiry; error?: string } | null;
    if (!response.ok || !result?.inquiry) {
      setError(result?.error ?? '문의를 불러오지 못했습니다.');
      return;
    }
    setInquiry(result.inquiry);
  }

  useEffect(() => {
    void load();
  }, [inquiryId]);

  async function upload() {
    if (!file) return;
    setError('');
    setSuccess('');
    setUploading(true);
    const formData = new FormData();
    formData.set('file', file);
    const response = await fetch(`/api/concierge/contact/inquiries/${inquiryId}/family-relation-certificate`, {
      method: 'POST',
      body: formData,
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) setError(result?.error ?? '파일을 제출하지 못했습니다.');
    else {
      setSuccess('가족관계증명서 PDF를 제출했습니다.');
      setFile(null);
      await load();
    }
    setUploading(false);
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  if (error && !inquiry) return <Alert severity="error">{error}</Alert>;
  if (!inquiry) return null;
  const canUpload = inquiry.inquiry_type === 'minor_purchase_cancellation' && inquiry.status === 'info_requested';

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={1}>
          <Typography variant="overline">{inquiryTypeLabels[inquiry.inquiry_type]}</Typography>
          <Typography variant="h5" fontWeight={700}>
            {inquiry.title}
          </Typography>
          <Typography whiteSpace="pre-wrap">{inquiry.content}</Typography>
          <Typography color="text.secondary">상태: {inquiry.status}</Typography>
          {inquiry.resolution_code ? (
            <>
              <Typography fontWeight={700}>결과: {inquiryResolutionLabels[inquiry.resolution_code]}</Typography>
              <Typography whiteSpace="pre-wrap">{inquiry.resolution_summary}</Typography>
            </>
          ) : null}
        </Stack>
      </Paper>
      {canUpload ? (
        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={700}>
              가족관계증명서 제출
            </Typography>
            <Typography>정부24에서 발급받은 가족관계증명서 PDF만 제출해 주세요.</Typography>
            <Button component="label" variant="outlined">
              PDF 선택
              <input hidden type="file" accept="application/pdf,.pdf" onChange={chooseFile} />
            </Button>
            {file ? <Typography>{file.name}</Typography> : null}
            <Box>
              <Button variant="contained" disabled={!file || uploading} onClick={() => void upload()}>
                {uploading ? '제출 중' : '제출'}
              </Button>
            </Box>
          </Stack>
        </Paper>
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {success ? <Alert severity="success">{success}</Alert> : null}
    </Stack>
  );
}
