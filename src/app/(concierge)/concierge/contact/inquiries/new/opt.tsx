'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { inquirySubtypes, inquiryTypeLabels, inquiryTypes, type InquiryType } from '@/lib/concierge/inquiries';
import Anchor from '@/components/Anchor';

type PaymentRow = {
  id: string;
  order_no: string;
  amount: number;
};

const inquiryTypeOptions = inquiryTypes.map((value) => ({ value, label: inquiryTypeLabels[value] }));

export default function Opt() {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [inquiryType, setInquiryType] = useState<InquiryType>('service_question');
  const [inquirySubtype, setInquirySubtype] = useState(inquirySubtypes.service_question[0].value);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadPayments() {
      const response = await fetch('/api/concierge/contact/inquiries?payments=true', { cache: 'no-store' });
      const result = (await response.json().catch(() => null)) as {
        payments?: PaymentRow[];
        error?: string;
      } | null;

      if (!response.ok) {
        setError(result?.error ?? '결제 내역을 불러오지 못했습니다.');
        return;
      }

      setPayments(result?.payments ?? []);
    }

    void loadPayments();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/concierge/contact/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryType,
          inquirySubtype,
          title,
          content,
          paymentId: inquiryType === 'minor_purchase_cancellation' ? paymentId : undefined,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        inquiry?: { id: string };
        error?: string;
      } | null;

      if (!response.ok || !result?.inquiry) {
        throw new Error(result?.error ?? '문의 접수에 실패했습니다.');
      }

      router.push(`/concierge/contact/inquiries/${result.inquiry.id}`);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : '문의 접수에 실패했습니다.');
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Stack direction="column" gap={3}>
        <div className="paper">
          <Stack gap={1}>
            <Typography variant="subtitle2">문의 유형</Typography>
            <TextField
              select
              fullWidth
              size="small"
              value={inquiryType}
              onChange={(event) => {
                const next = event.target.value as InquiryType;
                setInquiryType(next);
                setInquirySubtype(inquirySubtypes[next][0].value);
              }}
            >
              {inquiryTypeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack gap={1}>
            <Typography variant="subtitle2">세부 유형</Typography>
            <TextField
              select
              fullWidth
              size="small"
              value={inquirySubtype}
              onChange={(event) => setInquirySubtype(event.target.value)}
            >
              {inquirySubtypes[inquiryType].map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          {inquiryType === 'minor_purchase_cancellation' ? (
            <Stack gap={1}>
              <Typography variant="subtitle2">청약취소를 요청할 결제</Typography>
              <TextField
                select
                required
                fullWidth
                size="small"
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
            </Stack>
          ) : null}
          <Stack gap={1}>
            <Typography variant="subtitle2">제목</Typography>
            <TextField
              required
              fullWidth
              size="small"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              inputProps={{ maxLength: 120 }}
            />
          </Stack>
          <Stack gap={1}>
            <Typography variant="subtitle2">문의 내용</Typography>
            <TextField
              required
              multiline
              minRows={6}
              fullWidth
              size="small"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              inputProps={{ maxLength: 10000 }}
            />
            {error ? <Alert severity="error">{error}</Alert> : null}
          </Stack>
        </div>
        <Stack direction="row" justifyContent="flex-end" gap={2}>
          <Anchor href="/concierge/contact/inquiries" className="button medium close">
            뒤로가기
          </Anchor>
          <button type="submit" className="button medium submit" disabled={isSubmitting}>
            {isSubmitting ? '접수 중' : '문의 접수'}
          </button>
        </Stack>
      </Stack>
    </form>
  );
}
