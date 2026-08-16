'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Alert, Box, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { inquiryTypeLabels, inquiryTypes, type InquiryType } from '@/lib/concierge/inquiries';
import Anchor from '@/components/Anchor';

type InquiryRow = {
  id: string;
  inquiry_type: InquiryType;
  status: string;
  title: string;
  created_at: string;
  closed_at: string | null;
  resolution_code: string | null;
};

type PaymentRow = {
  id: string;
  order_no: string;
  payment_type: string;
  amount: number;
  currency: string;
  approved_at: string | null;
  status: string;
};

const inquiryTypeOptions = inquiryTypes.map((value) => ({ value, label: inquiryTypeLabels[value] }));

export default function Opt() {
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [inquiryType, setInquiryType] = useState<InquiryType>('service_question');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function load() {
    const response = await fetch('/api/concierge/contact/inquiries?payments=true', { cache: 'no-store' });
    const result = (await response.json().catch(() => null)) as {
      inquiries?: InquiryRow[];
      payments?: PaymentRow[];
      error?: string;
    } | null;

    if (!response.ok) {
      setError(result?.error ?? '문의 내역을 불러오지 못했습니다.');
      return;
    }

    setInquiries(result?.inquiries ?? []);
    setPayments(result?.payments ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/concierge/contact/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryType,
          title,
          content,
          paymentId: inquiryType === 'minor_purchase_cancellation' ? paymentId : undefined,
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? '문의 접수에 실패했습니다.');
      }

      setTitle('');
      setContent('');
      setPaymentId('');
      setSuccess('문의가 접수되었습니다.');
      await load();
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : '문의 접수에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Stack spacing={3}>
      <Paper component="form" onSubmit={submit} sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2.5}>
          <Typography variant="h5" fontWeight={700}>
            문의 접수
          </Typography>
          <TextField
            select
            label="문의 유형"
            value={inquiryType}
            onChange={(event) => setInquiryType(event.target.value as InquiryType)}
          >
            {inquiryTypeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          {inquiryType === 'minor_purchase_cancellation' ? (
            <TextField
              select
              required
              label="청약취소를 요청할 결제"
              value={paymentId}
              onChange={(event) => setPaymentId(event.target.value)}
              helperText="한 문의에는 결제 한 건만 선택할 수 있습니다."
            >
              {payments.map((payment) => (
                <MenuItem
                  key={payment.id}
                  value={payment.id}
                >{`${payment.order_no} · ${Number(payment.amount).toLocaleString('ko-KR')}원`}</MenuItem>
              ))}
            </TextField>
          ) : null}
          <TextField
            required
            label="제목"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            inputProps={{ maxLength: 120 }}
          />
          <TextField
            required
            multiline
            minRows={6}
            label="문의 내용"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            inputProps={{ maxLength: 10000 }}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          {success ? <Alert severity="success">{success}</Alert> : null}
          <Box>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isSubmitting ? '접수 중' : '문의 접수'}
            </Button>
          </Box>
        </Stack>
      </Paper>
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h5" fontWeight={700} mb={2}>
          문의 내역
        </Typography>
        <Stack spacing={1.5}>
          {inquiries.length === 0 ? <Typography color="text.secondary">문의 내역이 없습니다.</Typography> : null}
          {inquiries.map((inquiry) => (
            <Box key={inquiry.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
              <Typography
                component={Anchor}
                href={`/concierge/contact/inquiries/${inquiry.id}`}
                fontWeight={700}
                color="inherit"
              >
                {inquiry.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {inquiryTypeLabels[inquiry.inquiry_type]} · {inquiry.status} ·{' '}
                {new Date(inquiry.created_at).toLocaleDateString('ko-KR')}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
