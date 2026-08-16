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
  payment_control_requested_at: string | null;
  payment_control_selected_at: string | null;
  pg_cancellation_unavailable_at: string | null;
};
type Parent = {
  fatherName: string;
  fatherBirthDate: string;
  motherName: string;
  motherBirthDate: string;
  verifiedAt: string | null;
  certificateUrl: string | null;
};
type ManualRefund = { hasAccount: boolean; remainingAdjustmentAmount: number };

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
  const [fatherName, setFatherName] = useState('');
  const [fatherBirthDate, setFatherBirthDate] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherBirthDate, setMotherBirthDate] = useState('');
  const [manualRefund, setManualRefund] = useState<ManualRefund>({ hasAccount: false, remainingAdjustmentAmount: 0 });
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/concierge/inquiries/${params.inquiryId}`, { cache: 'no-store' });
      const result = (await response.json().catch(() => null)) as {
        inquiry?: Inquiry;
        parent?: Parent | null;
        manualRefund?: ManualRefund;
        error?: string;
      } | null;
      if (!response.ok || !result?.inquiry) {
        setError(result?.error ?? '문의를 불러오지 못했습니다.');
        return;
      }
      setInquiry(result.inquiry);
      setStatus(result.inquiry.status);
      setSummary(result.inquiry.resolution_summary ?? '');
      setResolutionCode(result.inquiry.resolution_code ?? resolutionOptions(result.inquiry.inquiry_type)[0]);
      if (result.parent) {
        setFatherName(result.parent.fatherName);
        setFatherBirthDate(result.parent.fatherBirthDate);
        setMotherName(result.parent.motherName);
        setMotherBirthDate(result.parent.motherBirthDate);
        setCertificateUrl(result.parent.certificateUrl);
      }
      if (result.manualRefund) setManualRefund(result.manualRefund);
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

  async function saveParents() {
    const response = await fetch(`/api/concierge/inquiries/${params.inquiryId}/parent-relationship`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fatherName, fatherBirthDate, motherName, motherBirthDate }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) setError(result?.error ?? '부·모 확인 정보를 저장하지 못했습니다.');
    else {
      setError('');
      await requestPaymentControl();
    }
  }

  async function requestPaymentControl() {
    const response = await fetch(`/api/concierge/inquiries/${params.inquiryId}/request-payment-control`, {
      method: 'POST',
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) setError(result?.error ?? '결제 방침 선택을 요청하지 못했습니다.');
  }

  async function approveCancellation() {
    setIsSaving(true);
    setError('');
    const response = await fetch(`/api/concierge/inquiries/${params.inquiryId}/approve-minor-cancellation`, {
      method: 'POST',
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) setError(result?.error ?? '청약취소를 처리하지 못했습니다.');
    else window.location.reload();
    setIsSaving(false);
  }

  async function completeManualRefund() {
    setIsSaving(true);
    setError('');
    const response = await fetch(`/api/concierge/inquiries/${params.inquiryId}/complete-manual-refund`, {
      method: 'POST',
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) setError(result?.error ?? '예외 계좌 반환을 완료하지 못했습니다.');
    else window.location.reload();
    setIsSaving(false);
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
          {inquiry.inquiry_type === 'minor_purchase_cancellation' ? (
            <>
              {certificateUrl ? (
                <Button component="a" href={certificateUrl} target="_blank" rel="noreferrer" variant="outlined">
                  가족관계증명서 PDF 확인
                </Button>
              ) : (
                <Alert severity="warning">제출된 가족관계증명서가 없습니다.</Alert>
              )}
              <TextField label="부 성명" value={fatherName} onChange={(event) => setFatherName(event.target.value)} />
              <TextField
                label="부 생년월일"
                value={fatherBirthDate}
                onChange={(event) => setFatherBirthDate(event.target.value)}
              />
              <TextField label="모 성명" value={motherName} onChange={(event) => setMotherName(event.target.value)} />
              <TextField
                label="모 생년월일"
                value={motherBirthDate}
                onChange={(event) => setMotherBirthDate(event.target.value)}
              />
              <Button variant="contained" onClick={() => void saveParents()}>
                부·모 확인 및 결제 방침 선택 요청
              </Button>
            </>
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
          {inquiry.inquiry_type === 'minor_purchase_cancellation' &&
          inquiry.payment_control_selected_at &&
          inquiry.status !== 'closed' ? (
            <Button color="error" variant="contained" disabled={isSaving} onClick={() => void approveCancellation()}>
              청약취소 승인 및 결제 취소
            </Button>
          ) : null}
          {inquiry.pg_cancellation_unavailable_at ? (
            <Alert severity={manualRefund.remainingAdjustmentAmount > 0 ? 'warning' : 'info'}>
              창작자 정산조정 잔액: {manualRefund.remainingAdjustmentAmount.toLocaleString('ko-KR')}원 · 반환 계좌:{' '}
              {manualRefund.hasAccount ? '등록됨' : '미등록'}
            </Alert>
          ) : null}
          {inquiry.pg_cancellation_unavailable_at &&
          manualRefund.hasAccount &&
          manualRefund.remainingAdjustmentAmount === 0 &&
          inquiry.status !== 'closed' ? (
            <Button color="error" variant="contained" disabled={isSaving} onClick={() => void completeManualRefund()}>
              계좌 반환 완료 처리
            </Button>
          ) : null}
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
