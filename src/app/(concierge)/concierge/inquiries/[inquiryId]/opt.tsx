'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Box, MenuItem, Stack, TextField, Typography } from '@mui/material';
import {
  inquiryResolutionLabels,
  inquiryTypeLabels,
  type InquiryResolutionCode,
  type InquiryType,
} from '@/lib/concierge/inquiries';
import Anchor from '@/components/Anchor';
import InquiryDetails from '@/components/concierge/InquiryDetails';

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
  inquiry_subtype: string | null;
  inquiry_bug_details: Parameters<typeof InquiryDetails>[0]['bugDetails'];
  inquiry_payment_details: Parameters<typeof InquiryDetails>[0]['paymentDetails'];
  evidenceUrl: string | null;
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
    if (!response.ok) setError(result?.error ?? '부 / 모 확인 정보를 저장하지 못했습니다.');
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

  if (error && !inquiry)
    return (
      <p className="alert error">
        <ErrorOutlineRoundedIcon />
        <span>{error}</span>
      </p>
    );
  if (!inquiry) return null;
  const options = resolutionOptions(inquiry.inquiry_type);
  return (
    <Stack gap={3}>
      <div className="paper">
        <Stack gap={1}>
          <Typography variant="subtitle2">{inquiryTypeLabels[inquiry.inquiry_type]}</Typography>
          <Typography variant="h6">{inquiry.title}</Typography>
          <InquiryDetails
            inquiryType={inquiry.inquiry_type}
            inquirySubtype={inquiry.inquiry_subtype}
            content={inquiry.content}
            bugDetails={inquiry.inquiry_bug_details}
            paymentDetails={inquiry.inquiry_payment_details}
            paymentId={inquiry.inquiry_orders[0]?.payment_id}
            evidenceUrl={inquiry.evidenceUrl}
          />
          {inquiry.inquiry_type === 'minor_purchase_cancellation' ? (
            <>
              {certificateUrl ? (
                <Anchor href={certificateUrl} target="_blank" rel="noreferrer" className="button small action">
                  가족관계증명서 PDF 확인
                </Anchor>
              ) : (
                <p className="alert warning">
                  <WarningAmberRoundedIcon />
                  <span>제출된 가족관계증명서가 없습니다.</span>
                </p>
              )}
              <Typography variant="subtitle2">부 성명</Typography>
              <TextField
                fullWidth
                size="small"
                value={fatherName}
                onChange={(event) => setFatherName(event.target.value)}
              />
              <Typography variant="subtitle2">부 생년월일</Typography>
              <TextField
                fullWidth
                size="small"
                value={fatherBirthDate}
                onChange={(event) => setFatherBirthDate(event.target.value)}
              />
              <Typography variant="subtitle2">모 성명</Typography>
              <TextField
                fullWidth
                size="small"
                value={motherName}
                onChange={(event) => setMotherName(event.target.value)}
              />
              <Typography variant="subtitle2">모 생년월일</Typography>
              <TextField
                fullWidth
                size="small"
                value={motherBirthDate}
                onChange={(event) => setMotherBirthDate(event.target.value)}
              />
              <button type="button" className="button medium submit" onClick={() => void saveParents()}>
                부 / 모 확인 및 결제 방침 선택 요청
              </button>
            </>
          ) : null}
        </Stack>
      </div>
      <form className="paper" onSubmit={save}>
        <Stack gap={2}>
          <Typography variant="h6">처리</Typography>
          <Typography variant="subtitle2">문의 상태</Typography>
          <TextField
            select
            fullWidth
            size="small"
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
              <Typography variant="subtitle2">종결 결과</Typography>
              <TextField
                select
                fullWidth
                size="small"
                value={resolutionCode}
                onChange={(event) => setResolutionCode(event.target.value as InquiryResolutionCode)}
              >
                {options.map((value) => (
                  <MenuItem key={value} value={value}>
                    {inquiryResolutionLabels[value]}
                  </MenuItem>
                ))}
              </TextField>
              <Typography variant="subtitle2">계정주 안내 내용</Typography>
              <TextField
                required
                multiline
                minRows={4}
                fullWidth
                size="small"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </>
          ) : null}
          {error ? (
            <p className="alert error">
              <ErrorOutlineRoundedIcon />
              <span>{error}</span>
            </p>
          ) : null}
          {inquiry.inquiry_type === 'minor_purchase_cancellation' &&
          inquiry.payment_control_selected_at &&
          inquiry.status !== 'closed' ? (
            <button
              type="button"
              className="button medium danger"
              disabled={isSaving}
              onClick={() => void approveCancellation()}
            >
              청약취소 승인 및 결제 취소
            </button>
          ) : null}
          {inquiry.pg_cancellation_unavailable_at ? (
            <p className={`alert ${manualRefund.remainingAdjustmentAmount > 0 ? 'warning' : 'info'}`}>
              {manualRefund.remainingAdjustmentAmount > 0 ? <WarningAmberRoundedIcon /> : <InfoOutlineRoundedIcon />}
              <span>
                창작자 정산조정 잔액: {manualRefund.remainingAdjustmentAmount.toLocaleString('ko-KR')}원 / 반환 계좌:{' '}
                {manualRefund.hasAccount ? '등록됨' : '미등록'}
              </span>
            </p>
          ) : null}
          {inquiry.pg_cancellation_unavailable_at &&
          manualRefund.hasAccount &&
          manualRefund.remainingAdjustmentAmount === 0 &&
          inquiry.status !== 'closed' ? (
            <button
              type="button"
              className="button medium danger"
              disabled={isSaving}
              onClick={() => void completeManualRefund()}
            >
              계좌 반환 완료 처리
            </button>
          ) : null}
          <Box>
            <button type="submit" className="button medium submit" disabled={isSaving}>
              {isSaving ? '저장 중' : '저장'}
            </button>
          </Box>
        </Stack>
      </form>
    </Stack>
  );
}
