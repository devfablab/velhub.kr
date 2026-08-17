'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import {
  inquiryInformationRequestLabels,
  inquiryResolutionLabels,
  inquiryStatusLabels,
  inquiryTypeLabels,
  type InquiryInformationRequestType,
  type InquiryResolutionCode,
  type InquiryStatus,
  type InquiryType,
} from '@/lib/concierge/inquiries';
import { formatDateTimeDetail } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import InquiryDetails from '@/components/concierge/InquiryDetails';
import styles from '@/app/concierge.module.sass';

type Inquiry = {
  id: string;
  requester_stigma_id: string;
  requesterActivityName: string;
  inquiry_type: InquiryType;
  status: InquiryStatus;
  title: string | null;
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
  information_request_type: InquiryInformationRequestType | null;
  information_requested_at: string | null;
  information_due_at: string | null;
  inquiry_messages: {
    id: string;
    sender_type: 'requester' | 'admin';
    message_type: 'message' | 'information_request' | 'information_response' | 'system';
    message: string;
    created_at: string;
  }[];
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
  const [informationRequestType, setInformationRequestType] = useState<InquiryInformationRequestType>('text_response');
  const [informationRequestMessage, setInformationRequestMessage] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [fatherName, setFatherName] = useState('');
  const [fatherBirthDate, setFatherBirthDate] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherBirthDate, setMotherBirthDate] = useState('');
  const [manualRefund, setManualRefund] = useState<ManualRefund>({ hasAccount: false, remainingAdjustmentAmount: 0 });
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
  const [parentVerifiedAt, setParentVerifiedAt] = useState<string | null>(null);
  const [pgCancellationCheckRequired, setPgCancellationCheckRequired] = useState(false);

  const load = useCallback(async () => {
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
      setParentVerifiedAt(result.parent.verifiedAt);
    }
    if (result.manualRefund) setManualRefund(result.manualRefund);
  }, [params.inquiryId]);

  useEffect(() => {
    void load();
  }, [load]);

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
          informationRequestType: status === 'info_requested' ? informationRequestType : undefined,
          informationRequestMessage: status === 'info_requested' ? informationRequestMessage : undefined,
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? '문의 상태를 저장하지 못했습니다.');
      setInformationRequestMessage('');
      await load();
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
      await load();
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
    if (!response.ok) {
      setError(result?.error ?? '청약취소를 처리하지 못했습니다.');
      if (response.status === 502) setPgCancellationCheckRequired(true);
    } else window.location.reload();
    setIsSaving(false);
  }

  async function markPgCancellationUnavailable() {
    setIsSaving(true);
    setError('');
    const response = await fetch(`/api/concierge/inquiries/${params.inquiryId}/mark-pg-cancellation-unavailable`, {
      method: 'POST',
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) setError(result?.error ?? '원결제수단 취소 불가 상태를 저장하지 못했습니다.');
    else {
      setPgCancellationCheckRequired(false);
      await load();
    }
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
  const statusOptions: InquiryStatus[] =
    inquiry.status === 'received'
      ? ['received', 'reviewing', 'info_requested', 'closed']
      : inquiry.status === 'reviewing'
        ? ['reviewing', 'info_requested', 'closed']
        : inquiry.status === 'info_requested'
          ? ['info_requested', 'reviewing', 'closed']
          : ['closed'];
  return (
    <div className={styles.inquiry}>
      <div className="paper">
        {inquiry.title ? (
          <h2>
            <Chip label={inquiryTypeLabels[inquiry.inquiry_type]} size="small" /> {inquiry.title}
          </h2>
        ) : (
          <Chip label={inquiryTypeLabels[inquiry.inquiry_type]} size="small" />
        )}
        <Stack>
          <Typography variant="subtitle2">문의자</Typography>
          <Typography variant="body2">{inquiry.requesterActivityName}</Typography>
        </Stack>
        <Stack>
          <Typography variant="subtitle2">상태</Typography>
          <Typography variant="body2">{inquiryStatusLabels[inquiry.status]}</Typography>
        </Stack>
        <Stack>
          <Typography variant="subtitle2">문의 날짜와 시간</Typography>
          <Typography variant="body2">{formatDateTimeDetail(inquiry.created_at)}</Typography>
        </Stack>
        <InquiryDetails
          inquiryType={inquiry.inquiry_type}
          inquirySubtype={inquiry.inquiry_subtype}
          content={inquiry.content}
          bugDetails={inquiry.inquiry_bug_details}
          paymentDetails={inquiry.inquiry_payment_details}
          paymentId={inquiry.inquiry_orders?.[0]?.payment_id}
          evidenceUrl={inquiry.evidenceUrl}
        />
        {inquiry.resolution_code ? (
          <Stack>
            <Typography variant="subtitle2">종결 결과</Typography>
            <Typography variant="body2">{inquiryResolutionLabels[inquiry.resolution_code]}</Typography>
            <Typography variant="body2" whiteSpace="pre-wrap">
              {inquiry.resolution_summary}
            </Typography>
          </Stack>
        ) : null}
      </div>
      {inquiry.inquiry_messages.length ? (
        <div className="paper">
          <h2>요청 / 답변 내역</h2>
          <Stack gap={2}>
            {[...inquiry.inquiry_messages]
              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              .map((message) => (
                <Stack key={message.id} gap={0.5}>
                  <Typography variant="subtitle2">
                    {message.sender_type === 'admin' ? '관리자' : '문의자'} / {formatDateTimeDetail(message.created_at)}
                  </Typography>
                  <Typography variant="body2" whiteSpace="pre-wrap">
                    {message.message}
                  </Typography>
                </Stack>
              ))}
          </Stack>
        </div>
      ) : null}
      {inquiry.inquiry_type === 'minor_purchase_cancellation' && inquiry.status !== 'closed' ? (
        <div className="paper">
          <h2>부모 정보 입력</h2>
          {certificateUrl ? (
            <Anchor href={certificateUrl} className="button small action">
              가족관계증명서 PDF 확인
            </Anchor>
          ) : (
            <p className="alert warning">
              <WarningAmberRoundedIcon />
              <span>제출된 가족관계증명서가 없습니다.</span>
            </p>
          )}
          <Stack>
            <Typography variant="subtitle2">부 성명</Typography>
            <TextField
              fullWidth
              size="small"
              value={fatherName}
              onChange={(event) => setFatherName(event.target.value)}
            />
          </Stack>
          <Stack>
            <Typography variant="subtitle2">부 생년월일</Typography>
            <TextField
              fullWidth
              size="small"
              value={fatherBirthDate}
              onChange={(event) => setFatherBirthDate(event.target.value)}
            />
          </Stack>
          <Stack>
            <Typography variant="subtitle2">모 성명</Typography>
            <TextField
              fullWidth
              size="small"
              value={motherName}
              onChange={(event) => setMotherName(event.target.value)}
            />
          </Stack>
          <Stack>
            <Typography variant="subtitle2">모 생년월일</Typography>
            <TextField
              fullWidth
              size="small"
              value={motherBirthDate}
              onChange={(event) => setMotherBirthDate(event.target.value)}
            />
            <button type="button" className="button medium submit" onClick={() => void saveParents()}>
              부 / 모 확인 정보 저장
            </button>
            {parentVerifiedAt && !inquiry.payment_control_requested_at ? (
              <button type="button" className="button medium action" onClick={() => void requestPaymentControl()}>
                향후 결제 방침 선택 요청
              </button>
            ) : null}
          </Stack>
        </div>
      ) : null}
      {inquiry.status !== 'closed' ? (
        <form onSubmit={save}>
          <div className="paper">
            <h2>처리폼</h2>
            <Typography variant="subtitle2">문의 상태</Typography>
            <TextField
              select
              fullWidth
              size="small"
              value={status}
              onChange={(event) => setStatus(event.target.value as Inquiry['status'])}
            >
              {statusOptions.map((value) => (
                <MenuItem key={value} value={value} disabled={value === inquiry.status && value !== 'info_requested'}>
                  {inquiryStatusLabels[value]}
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
            {status === 'info_requested' ? (
              <>
                <Typography variant="subtitle2">요청할 정보</Typography>
                <TextField
                  select
                  fullWidth
                  size="small"
                  value={informationRequestType}
                  onChange={(event) => setInformationRequestType(event.target.value as InquiryInformationRequestType)}
                >
                  <MenuItem value="text_response">{inquiryInformationRequestLabels.text_response}</MenuItem>
                  {['bug_report', 'payment_refund_error'].includes(inquiry.inquiry_type) ? (
                    <MenuItem value="evidence">{inquiryInformationRequestLabels.evidence}</MenuItem>
                  ) : null}
                  {inquiry.inquiry_type === 'minor_purchase_cancellation' ? (
                    <MenuItem value="family_relation_certificate">
                      {inquiryInformationRequestLabels.family_relation_certificate}
                    </MenuItem>
                  ) : null}
                  {inquiry.pg_cancellation_unavailable_at ? (
                    <MenuItem value="refund_account">{inquiryInformationRequestLabels.refund_account}</MenuItem>
                  ) : null}
                </TextField>
                <Typography variant="subtitle2">요청 내용</Typography>
                <TextField
                  required
                  multiline
                  minRows={4}
                  fullWidth
                  size="small"
                  value={informationRequestMessage}
                  onChange={(event) => setInformationRequestMessage(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 10000 } }}
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
            !inquiry.pg_cancellation_unavailable_at ? (
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
            {pgCancellationCheckRequired && !inquiry.pg_cancellation_unavailable_at ? (
              <>
                <p className="alert warning">
                  <WarningAmberRoundedIcon />
                  <span>PG 또는 포트원에서 원결제수단 취소가 실제로 불가능한지 확인한 뒤 처리해 주세요.</span>
                </p>
                <button
                  type="button"
                  className="button medium danger"
                  disabled={isSaving}
                  onClick={() => void markPgCancellationUnavailable()}
                >
                  원결제수단 취소 불가 확정
                </button>
              </>
            ) : null}
            {inquiry.pg_cancellation_unavailable_at &&
            manualRefund.hasAccount &&
            manualRefund.remainingAdjustmentAmount === 0 ? (
              <button
                type="button"
                className="button medium danger"
                disabled={isSaving}
                onClick={() => void completeManualRefund()}
              >
                계좌 반환 완료 처리
              </button>
            ) : null}
            <Stack direction="row" justifyContent="flex-end">
              <button
                type="submit"
                className="button medium submit"
                disabled={isSaving || (status === inquiry.status && status !== 'info_requested')}
              >
                {isSaving ? '저장 중' : '저장'}
              </button>
            </Stack>
          </div>
        </form>
      ) : null}
    </div>
  );
}
