'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { FormControlLabel, MenuItem, Radio, RadioGroup, Stack, TextField, Typography, styled } from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ko } from 'date-fns/locale';
import { inquirySubtypes, inquiryTypeLabels, inquiryTypes, type InquiryType } from '@/lib/concierge/inquiries';
import Anchor from '@/components/Anchor';

type PaymentRow = {
  id: string;
  label: string;
  approvedAt: string | null;
  status: string;
};

const recurrenceOptions = [
  { value: 'always', label: '항상 발생' },
  { value: 'often', label: '자주 발생' },
  { value: 'sometimes', label: '가끔 발생' },
  { value: 'once', label: '한 번만 발생' },
];

const inquiryTypeOptions = inquiryTypes.map((value) => ({ value, label: inquiryTypeLabels[value] }));

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

export default function Opt() {
  const router = useRouter();
  const evidenceInputRef = useRef<HTMLInputElement | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [cancellationPayments, setCancellationPayments] = useState<PaymentRow[]>([]);
  const [cancellationAvailableAt, setCancellationAvailableAt] = useState<string | null>(null);
  const [inquiryType, setInquiryType] = useState<InquiryType>('service_question');
  const [inquirySubtype, setInquirySubtype] = useState(inquirySubtypes.service_question[0].value);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [occurredAt, setOccurredAt] = useState<Date | null>(() => new Date());
  const [attemptedAction, setAttemptedAction] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [recurrence, setRecurrence] = useState('sometimes');
  const [errorMessage, setErrorMessage] = useState('');
  const [attemptedProduct, setAttemptedProduct] = useState('');
  const [displayedMessage, setDisplayedMessage] = useState('');
  const [evidence, setEvidence] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadPayments() {
      const [cancellationResponse, paymentResponse] = await Promise.all([
        fetch('/api/concierge/contact/inquiries?payments=true', { cache: 'no-store' }),
        fetch('/api/concierge/contact/inquiries?payments=all', { cache: 'no-store' }),
      ]);
      const result = (await cancellationResponse.json().catch(() => null)) as {
        payments?: PaymentRow[];
        cancellationAvailableAt?: string | null;
        error?: string;
      } | null;
      const paymentResult = (await paymentResponse.json().catch(() => null)) as {
        payments?: PaymentRow[];
        error?: string;
      } | null;

      if (!cancellationResponse.ok || !paymentResponse.ok) {
        setError(result?.error ?? '결제 내역을 불러오지 못했습니다.');
        return;
      }

      setCancellationPayments(result?.payments ?? []);
      setPayments(paymentResult?.payments ?? []);
      setCancellationAvailableAt(result?.cancellationAvailableAt ?? null);
    }

    void loadPayments();
  }, []);

  const isMinorCancellation = inquiryType === 'minor_purchase_cancellation';
  const isBug = inquiryType === 'bug_report';
  const isPaymentProblem = inquiryType === 'payment_refund_error';
  const paymentRequired = isPaymentProblem && inquirySubtype !== 'payment_declined';
  const isCancellationBlocked =
    isMinorCancellation && !!cancellationAvailableAt && new Date(cancellationAvailableAt).getTime() > Date.now();

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
          paymentId: isMinorCancellation || paymentRequired ? paymentId : undefined,
          pageUrl,
          occurredAt: occurredAt?.toISOString() ?? '',
          attemptedAction,
          actualBehavior,
          recurrence,
          errorMessage,
          attemptedProduct,
          displayedMessage,
          environment: {
            browserName: navigator.userAgent.match(/(Edg|Chrome|Firefox|Safari)\/?\s*([\d.]*)/i)?.[1] ?? 'unknown',
            browserVersion: navigator.userAgent.match(/(Edg|Chrome|Firefox|Version)\/?\s*([\d.]*)/i)?.[2] ?? '',
            operatingSystem: navigator.platform,
            deviceType: window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop',
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            userAgent: navigator.userAgent,
          },
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        inquiry?: { id: string };
        error?: string;
      } | null;

      if (!response.ok || !result?.inquiry) {
        throw new Error(result?.error ?? '문의 접수에 실패했습니다.');
      }

      if (evidence && (isBug || isPaymentProblem)) {
        const formData = new FormData();
        formData.set('file', evidence);
        const uploadResponse = await fetch(`/api/concierge/contact/inquiries/${result.inquiry.id}/evidence`, {
          method: 'POST',
          body: formData,
        });
        const uploadResult = (await uploadResponse.json().catch(() => null)) as { error?: string } | null;
        if (!uploadResponse.ok)
          throw new Error(uploadResult?.error ?? '문의는 접수됐지만 첨부 파일을 저장하지 못했습니다.');
      }

      router.push(`/concierge/contact/inquiries/${result.inquiry.id}`);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : '문의 접수에 실패했습니다.');
      setIsSubmitting(false);
    }
  }

  function chooseEvidence(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    setError('');
    if (selectedFile && selectedFile.size > 1024 * 1024) {
      setEvidence(null);
      setError('첨부 파일은 1MB 이하만 가능합니다.');
      event.target.value = '';
      return;
    }
    setEvidence(selectedFile);
  }

  function removeEvidence() {
    setEvidence(null);
    if (evidenceInputRef.current) evidenceInputRef.current.value = '';
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
          {isMinorCancellation ? (
            <Stack gap={2}>
              <p className="alert info">
                <InfoOutlineRoundedIcon />
                <span>청약취소를 신청하면 신청 시각부터 15일 동안 다른 결제 건의 청약취소를 신청할 수 없습니다.</span>
              </p>
              {isCancellationBlocked ? (
                <p className="alert warning">
                  <WarningAmberRoundedIcon />
                  <span>
                    다른 결제 건은{' '}
                    {new Date(cancellationAvailableAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}부터 신청할
                    수 있습니다.
                  </span>
                </p>
              ) : (
                <Stack>
                  <Typography variant="subtitle2">청약취소를 요청할 결제</Typography>
                  {cancellationPayments.length ? (
                    <RadioGroup value={paymentId} onChange={(event) => setPaymentId(event.target.value)}>
                      {cancellationPayments.map((payment) => (
                        <FormControlLabel
                          key={payment.id}
                          value={payment.id}
                          control={<Radio />}
                          label={payment.label}
                        />
                      ))}
                    </RadioGroup>
                  ) : (
                    <Typography variant="body2">청약취소를 신청할 수 있는 결제 내역이 없습니다.</Typography>
                  )}
                </Stack>
              )}
            </Stack>
          ) : null}
          {isPaymentProblem ? (
            <Stack gap={2}>
              <p className="alert info">
                <InfoOutlineRoundedIcon />
                <span>
                  일반적인 결제 취소 및 환불은 결제 내역에서 직접 처리해 주세요. 이곳에서는 결제 또는 취소 과정에서
                  문제가 발생했거나 처리 결과가 정상적으로 반영되지 않은 경우만 접수합니다.
                </span>
              </p>
              {paymentRequired ? (
                <Stack gap={1}>
                  <Typography variant="subtitle2">문제가 발생한 결제</Typography>
                  {payments.length ? (
                    <RadioGroup value={paymentId} onChange={(event) => setPaymentId(event.target.value)}>
                      {payments.map((payment) => (
                        <FormControlLabel
                          key={payment.id}
                          value={payment.id}
                          control={<Radio />}
                          label={payment.label}
                        />
                      ))}
                    </RadioGroup>
                  ) : (
                    <Typography variant="body2">선택할 수 있는 결제 내역이 없습니다.</Typography>
                  )}
                </Stack>
              ) : (
                <Stack gap={1}>
                  <Typography variant="subtitle2">결제를 시도한 상품 또는 기능</Typography>
                  <TextField
                    required
                    fullWidth
                    size="small"
                    value={attemptedProduct}
                    onChange={(event) => setAttemptedProduct(event.target.value)}
                    slotProps={{ htmlInput: { maxLength: 500 } }}
                  />
                </Stack>
              )}
              <Stack gap={1}>
                <Typography variant="subtitle2">문제가 발생한 날짜와 시간</Typography>
                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                  <DateTimePicker
                    value={occurredAt}
                    onChange={setOccurredAt}
                    ampm={false}
                    views={['year', 'month', 'day', 'hours', 'minutes']}
                    format="yyyy년 MM월 dd일 HH시 mm분"
                    slotProps={{
                      textField: {
                        required: true,
                        fullWidth: true,
                        size: 'small',
                      },
                    }}
                  />
                </LocalizationProvider>
              </Stack>
              <Stack gap={1}>
                <Typography variant="subtitle2">화면에 표시된 메시지</Typography>
                <TextField
                  multiline
                  minRows={2}
                  fullWidth
                  size="small"
                  value={displayedMessage}
                  onChange={(event) => setDisplayedMessage(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 5000 } }}
                />
              </Stack>
              <Stack gap={1}>
                <Typography variant="subtitle2">실제로 발생한 상황</Typography>
                <TextField
                  required
                  multiline
                  minRows={5}
                  fullWidth
                  size="small"
                  value={actualBehavior}
                  onChange={(event) => setActualBehavior(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 5000 } }}
                />
              </Stack>
            </Stack>
          ) : null}
          {isBug ? (
            <Stack gap={2}>
              <Stack gap={1}>
                <Typography variant="subtitle2">문제가 발생한 화면 주소</Typography>
                <TextField
                  required
                  type="url"
                  fullWidth
                  size="small"
                  value={pageUrl}
                  onChange={(event) => setPageUrl(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 2000 } }}
                />
              </Stack>
              <Stack gap={1}>
                <Typography variant="subtitle2">문제가 발생한 날짜와 시간</Typography>
                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                  <DateTimePicker
                    value={occurredAt}
                    onChange={setOccurredAt}
                    ampm={false}
                    views={['year', 'month', 'day', 'hours', 'minutes']}
                    format="yyyy년 MM월 dd일 HH시 mm분"
                    slotProps={{
                      textField: {
                        required: true,
                        fullWidth: true,
                        size: 'small',
                      },
                    }}
                  />
                </LocalizationProvider>
              </Stack>
              <Stack gap={1}>
                <Typography variant="subtitle2">하려고 했던 작업</Typography>
                <TextField
                  required
                  multiline
                  minRows={2}
                  fullWidth
                  size="small"
                  value={attemptedAction}
                  onChange={(event) => setAttemptedAction(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 2000 } }}
                />
              </Stack>
              <Stack gap={1}>
                <Typography variant="subtitle2">실제로 발생한 문제</Typography>
                <TextField
                  required
                  multiline
                  minRows={5}
                  fullWidth
                  size="small"
                  value={actualBehavior}
                  onChange={(event) => setActualBehavior(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 5000 } }}
                />
              </Stack>
              <Stack gap={1}>
                <Typography variant="subtitle2">같은 문제가 다시 발생하나요?</Typography>
                <TextField
                  select
                  fullWidth
                  size="small"
                  value={recurrence}
                  onChange={(event) => setRecurrence(event.target.value)}
                >
                  {recurrenceOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <Stack gap={1}>
                <Typography variant="subtitle2">화면에 표시된 에러 메시지</Typography>
                <TextField
                  multiline
                  minRows={2}
                  fullWidth
                  size="small"
                  value={errorMessage}
                  onChange={(event) => setErrorMessage(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 5000 } }}
                />
              </Stack>
            </Stack>
          ) : null}
          {isBug || isPaymentProblem ? (
            <Stack gap={1}>
              <Typography variant="subtitle2">문제가 된 페이지 캡쳐 이미지 첨부</Typography>
              <p className="alert info">
                <InfoOutlineRoundedIcon />
                <span>
                  이미지는 PNG, JPG, WEBP 형식만 가능하며 1MB 이하만 첨부할 수 있습니다. PDF 파일도 첨부할 수 있습니다.
                </span>
              </p>
              <VisuallyHiddenInput
                ref={evidenceInputRef}
                type="file"
                accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp"
                onChange={chooseEvidence}
              />
              <Stack direction="row" gap={1} alignItems="center">
                <button type="button" className="button small action" onClick={() => evidenceInputRef.current?.click()}>
                  파일 선택
                </button>
                {evidence ? (
                  <button type="button" className="button small danger" onClick={removeEvidence}>
                    파일 삭제
                  </button>
                ) : null}
              </Stack>
              {evidence ? <Typography variant="body2">{evidence.name}</Typography> : null}
            </Stack>
          ) : null}
          {!isBug && !isPaymentProblem ? (
            <Stack gap={3}>
              <Stack gap={1}>
                <Typography variant="subtitle2">제목</Typography>
                <TextField
                  required
                  fullWidth
                  size="small"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 120 } }}
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
                  slotProps={{ htmlInput: { maxLength: 10000 } }}
                />
              </Stack>
            </Stack>
          ) : null}
          {error ? (
            <p className="alert error">
              <ErrorOutlineRoundedIcon />
              <span>{error}</span>
            </p>
          ) : null}
        </div>
        <Stack direction="row" justifyContent="flex-end" gap={2}>
          <Anchor href="/concierge/contact/inquiries" className="button medium close">
            뒤로가기
          </Anchor>
          <button type="submit" className="button medium submit" disabled={isSubmitting || isCancellationBlocked}>
            {isSubmitting ? '접수 중' : '문의 접수'}
          </button>
        </Stack>
      </Stack>
    </form>
  );
}
