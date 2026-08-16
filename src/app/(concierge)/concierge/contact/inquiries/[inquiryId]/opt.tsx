/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Alert, Box, MenuItem, Stack, TextField, Typography } from '@mui/material';
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
  payment_control_requested_at: string | null;
  payment_control_selected_at: string | null;
  pg_cancellation_unavailable_at: string | null;
  manual_refund_ready_at: string | null;
};

export default function Opt() {
  const { inquiryId } = useParams<{ inquiryId: string }>();
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);
  const [savingControl, setSavingControl] = useState(false);
  const [holderType, setHolderType] = useState('account_holder');
  const [holderName, setHolderName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

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

  async function choosePaymentControl(mode: 'blocked_until_adult' | 'guardian_auth_required') {
    setSavingControl(true);
    setError('');
    const response = await fetch(`/api/concierge/contact/inquiries/${inquiryId}/payment-minor-control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) setError(result?.error ?? '결제 방침을 저장하지 못했습니다.');
    else {
      setSuccess('향후 결제 방침을 저장했습니다.');
      await load();
    }
    setSavingControl(false);
  }

  async function saveRefundAccount() {
    const response = await fetch(`/api/concierge/contact/inquiries/${inquiryId}/refund-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holderType, holderName, bankCode, accountNumber }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) setError(result?.error ?? '반환 계좌를 저장하지 못했습니다.');
    else {
      setSuccess('예외 반환 계좌를 저장했습니다.');
      await load();
    }
  }

  if (error && !inquiry) return <Alert severity="error">{error}</Alert>;
  if (!inquiry) return null;
  const canUpload = inquiry.inquiry_type === 'minor_purchase_cancellation' && inquiry.status === 'info_requested';

  return (
    <Stack gap={3}>
      <div className="paper">
        <Stack gap={1}>
          <Typography variant="subtitle2">{inquiryTypeLabels[inquiry.inquiry_type]}</Typography>
          <Typography variant="h6">{inquiry.title}</Typography>
          <Typography whiteSpace="pre-wrap">{inquiry.content}</Typography>
          <Typography color="text.secondary">상태: {inquiry.status}</Typography>
          {inquiry.resolution_code ? (
            <>
              <Typography variant="subtitle2">결과: {inquiryResolutionLabels[inquiry.resolution_code]}</Typography>
              <Typography whiteSpace="pre-wrap">{inquiry.resolution_summary}</Typography>
            </>
          ) : null}
        </Stack>
      </div>
      {canUpload ? (
        <div className="paper">
          <Stack gap={2}>
            <Typography variant="h6">가족관계증명서 제출</Typography>
            <Typography>정부24에서 발급받은 가족관계증명서 PDF만 제출해 주세요.</Typography>
            <label className="button small action">
              PDF 선택
              <input hidden type="file" accept="application/pdf,.pdf" onChange={chooseFile} />
            </label>
            {file ? <Typography>{file.name}</Typography> : null}
            <Box>
              <button
                type="button"
                className="button medium submit"
                disabled={!file || uploading}
                onClick={() => void upload()}
              >
                {uploading ? '제출 중' : '제출'}
              </button>
            </Box>
          </Stack>
        </div>
      ) : null}
      {inquiry.payment_control_requested_at && !inquiry.payment_control_selected_at ? (
        <div className="paper">
          <Stack gap={2}>
            <Typography variant="h6">향후 결제·구매·후원 방침</Typography>
            <Typography>청약취소 처리 후 만 19세가 되기 전까지 적용할 방침을 선택해 주세요.</Typography>
            <button
              type="button"
              className="button medium submit"
              disabled={savingControl}
              onClick={() => void choosePaymentControl('blocked_until_adult')}
            >
              이 계정에서 만 19세가 될 때까지 결제·구매·후원을 허용하지 않습니다.
            </button>
            <button
              type="button"
              className="button medium action"
              disabled={savingControl}
              onClick={() => void choosePaymentControl('guardian_auth_required')}
            >
              이후 결제마다 법정대리인 본인인증 후 허용합니다.
            </button>
          </Stack>
        </div>
      ) : null}
      {inquiry.pg_cancellation_unavailable_at && !inquiry.manual_refund_ready_at ? (
        <div className="paper">
          <Stack gap={2}>
            <Typography variant="h6">반환 계좌 입력</Typography>
            <Typography>원결제수단 취소가 불가능하여 계정주 본인, 부 또는 모 명의 계좌로 전액을 반환합니다.</Typography>
            <Typography variant="subtitle2">계좌 명의자</Typography>
            <TextField
              select
              fullWidth
              size="small"
              value={holderType}
              onChange={(event) => setHolderType(event.target.value)}
            >
              <MenuItem value="account_holder">계정주 본인</MenuItem>
              <MenuItem value="father">부</MenuItem>
              <MenuItem value="mother">모</MenuItem>
            </TextField>
            <Typography variant="subtitle2">예금주명</Typography>
            <TextField
              fullWidth
              size="small"
              value={holderName}
              onChange={(event) => setHolderName(event.target.value)}
            />
            <Typography variant="subtitle2">은행 코드</Typography>
            <TextField fullWidth size="small" value={bankCode} onChange={(event) => setBankCode(event.target.value)} />
            <Typography variant="subtitle2">계좌번호</Typography>
            <TextField
              fullWidth
              size="small"
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value)}
            />
            <button type="button" className="button medium submit" onClick={() => void saveRefundAccount()}>
              반환 계좌 저장
            </button>
          </Stack>
        </div>
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {success ? <Alert severity="success">{success}</Alert> : null}
    </Stack>
  );
}
