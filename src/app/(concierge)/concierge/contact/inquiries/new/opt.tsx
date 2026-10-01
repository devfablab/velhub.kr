'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {
  Checkbox,
  FormControlLabel,
  InputAdornment,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
  styled,
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ko } from 'date-fns/locale';
import { inquirySubtypes, inquiryTypeLabels, inquiryTypes, type InquiryType } from '@/lib/concierge/inquiries';
import { runInputAdornmentAction } from '@/lib/input/runInputAdornmentAction';
import { MEMBERSHIP_FEATURES, type MembershipFeatureKey, type MembershipType } from '@/lib/memberships/catalog';
import { formatCurrencyInput, parseCurrencyInput } from '@/lib/payments/currencyInput';
import { formatDateTimeDetail } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import FormErrorDialog from '@/components/FormErrorDialog';
import MenuItem from '@/components/SelectMenuItem';
import { SelectCheckAdornment } from '@/components/SelectWithCheck';

export type PaymentRow = {
  id: string;
  label: string;
  approvedAt: string | null;
  status: string;
};

type TargetOption = {
  id: string;
  label: string;
  description?: string;
  boardId?: string;
};

type AttemptedPaymentKind = 'membership' | 'subscription' | 'donation' | 'post_purchase';
type FieldErrors = Partial<
  Record<
    | 'title'
    | 'content'
    | 'pageUrl'
    | 'occurredAt'
    | 'attemptedAction'
    | 'actualBehavior'
    | 'recurrence'
    | 'paymentId'
    | 'attemptedPayment'
    | 'displayedMessage'
    | 'errorMessage',
    string
  >
>;

const recurrenceOptions = [
  { value: 'always', label: '항상 발생' },
  { value: 'often', label: '자주 발생' },
  { value: 'sometimes', label: '가끔 발생' },
  { value: 'once', label: '한 번만 발생' },
];

const inquiryTypeOptions = inquiryTypes.map((value) => ({ value, label: inquiryTypeLabels[value] }));

const attemptedPaymentKinds: { value: AttemptedPaymentKind; label: string }[] = [
  { value: 'membership', label: '멤버십' },
  { value: 'subscription', label: '구독' },
  { value: 'donation', label: '후원' },
  { value: 'post_purchase', label: '연재글 영구소장' },
];

const membershipTypes: { value: MembershipType; label: string }[] = [
  { value: 'owner', label: '오너 멤버십' },
  { value: 'creator', label: '크리에이터 멤버십' },
  { value: 'all_in_one', label: '올인원 멤버십' },
  { value: 'affetto', label: '아페토 멤버십' },
];

const subscriptionTypes = [
  { value: 'site_subscription', label: '블로그 구독' },
  { value: 'series_subscription', label: '연재 구독' },
];

const donationTypes = [
  { value: 'site_donation', label: '블로그 후원' },
  { value: 'series_donation', label: '연재 후원' },
];

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

export default function Opt({
  initialPayments,
  initialCancellationPayments,
  initialCancellationAvailableAt,
  initialPaymentError,
}: {
  initialPayments: PaymentRow[];
  initialCancellationPayments: PaymentRow[];
  initialCancellationAvailableAt: string | null;
  initialPaymentError: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedPaymentId = searchParams.get('paymentId')?.trim() ?? '';
  const isAutoMinorCancellation =
    searchParams.get('inquiryType') === 'minor_purchase_cancellation' && Boolean(requestedPaymentId);
  const evidenceInputRef = useRef<HTMLInputElement | null>(null);
  const payments = initialPayments;
  const cancellationPayments = initialCancellationPayments;
  const cancellationAvailableAt = initialCancellationAvailableAt;
  const paymentLoadError = initialPaymentError;
  const [inquiryType, setInquiryType] = useState<InquiryType>(
    isAutoMinorCancellation ? 'minor_purchase_cancellation' : 'service_question',
  );
  const [inquirySubtype, setInquirySubtype] = useState(
    isAutoMinorCancellation ? 'minor_contract_cancellation' : inquirySubtypes.service_question[0].value,
  );
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [paymentId, setPaymentId] = useState(requestedPaymentId);
  const [pageUrl, setPageUrl] = useState('');
  const [occurredAt, setOccurredAt] = useState<Date | null>(() => new Date());
  const [attemptedAction, setAttemptedAction] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [recurrence, setRecurrence] = useState('sometimes');
  const [errorMessage, setErrorMessage] = useState('');
  const [attemptedPaymentKind, setAttemptedPaymentKind] = useState<AttemptedPaymentKind>('membership');
  const [attemptedPaymentSubtype, setAttemptedPaymentSubtype] = useState('');
  const [attemptedMembershipType, setAttemptedMembershipType] = useState<MembershipType>('owner');
  const [attemptedFeatureKeys, setAttemptedFeatureKeys] = useState<MembershipFeatureKey[]>([]);
  const [siteQuery, setSiteQuery] = useState('');
  const [siteResults, setSiteResults] = useState<TargetOption[]>([]);
  const [selectedSite, setSelectedSite] = useState<TargetOption | null>(null);
  const [targetOptions, setTargetOptions] = useState<TargetOption[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState('');
  const [postQuery, setPostQuery] = useState('');
  const [postResults, setPostResults] = useState<TargetOption[]>([]);
  const [selectedPostId, setSelectedPostId] = useState('');
  const [attemptedAmount, setAttemptedAmount] = useState('');
  const [searchingTargets, setSearchingTargets] = useState(false);
  const [displayedMessage, setDisplayedMessage] = useState('');
  const [evidence, setEvidence] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorDialog, setErrorDialog] = useState<{ title: string | null; messages: string[] } | null>(null);

  useEffect(() => {
    if (!isAutoMinorCancellation) return;
    setInquiryType('minor_purchase_cancellation');
    setInquirySubtype('minor_contract_cancellation');
    setPaymentId(requestedPaymentId);
  }, [isAutoMinorCancellation, requestedPaymentId]);

  const isMinorCancellation = inquiryType === 'minor_purchase_cancellation';
  const isBug = inquiryType === 'bug_report';
  const isPaymentProblem = inquiryType === 'payment_refund_error';
  const paymentRequired = isPaymentProblem && inquirySubtype !== 'payment_declined';
  const needsSite = attemptedPaymentKind !== 'membership';
  const needsSeries =
    attemptedPaymentSubtype === 'series_subscription' ||
    attemptedPaymentSubtype === 'series_donation' ||
    attemptedPaymentKind === 'post_purchase';
  const needsPost = attemptedPaymentKind === 'post_purchase';
  const isCancellationBlocked =
    isMinorCancellation && !!cancellationAvailableAt && new Date(cancellationAvailableAt).getTime() > Date.now();
  const cancellationAvailableAtLabel = cancellationAvailableAt
    ? formatDateTimeDetail(cancellationAvailableAt)
    : '';
  const selectedCancellationPayment = cancellationPayments.find((payment) => payment.id === paymentId) ?? null;
  const inquiryUnavailableReason = isMinorCancellation
    ? paymentLoadError || isCancellationBlocked
      ? paymentLoadError || `다른 결제 건은 ${cancellationAvailableAtLabel}부터 신청할 수 있습니다.`
      : isAutoMinorCancellation && !selectedCancellationPayment
        ? '청약취소를 신청할 수 없는 결제입니다.'
        : !cancellationPayments.length
          ? '청약취소를 신청할 수 있는 결제 내역이 없습니다.'
          : ''
    : paymentRequired
      ? paymentLoadError || (!payments.length ? '문의할 수 있는 결제 내역이 없습니다.' : '')
      : '';

  function validateFields() {
    const next: FieldErrors = {};
    if (!isBug && !isPaymentProblem) {
      if (!title.trim()) next.title = '제목을 입력해 주세요.';
      else if (title.trim().length > 120) next.title = '제목은 120자 이하로 입력해 주세요.';
      if (!content.trim()) next.content = '문의 내용을 입력해 주세요.';
      else if (content.trim().length > 10000) next.content = '문의 내용은 10,000자 이하로 입력해 주세요.';
    }
    if (isBug) {
      if (!pageUrl.trim()) next.pageUrl = '문제가 발생한 화면 주소를 입력해 주세요.';
      else {
        try {
          const url = new URL(pageUrl);
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
        } catch {
          next.pageUrl = 'http 또는 https 주소를 입력해 주세요.';
        }
      }
      if (pageUrl.length > 2000) next.pageUrl = '문제가 발생한 화면 주소는 2,000자 이하로 입력해 주세요.';
      if (!occurredAt) next.occurredAt = '문제가 발생한 날짜와 시간을 입력해 주세요.';
      if (!attemptedAction.trim()) next.attemptedAction = '하려고 했던 작업을 입력해 주세요.';
      else if (attemptedAction.length > 2000) next.attemptedAction = '하려고 했던 작업은 2,000자 이하로 입력해 주세요.';
      if (!actualBehavior.trim()) next.actualBehavior = '실제로 발생한 문제를 입력해 주세요.';
      else if (actualBehavior.length > 5000) next.actualBehavior = '실제로 발생한 문제는 5,000자 이하로 입력해 주세요.';
      if (errorMessage.length > 5000) next.errorMessage = '오류 메시지는 5,000자 이하로 입력해 주세요.';
      if (!['always', 'often', 'sometimes', 'once'].includes(recurrence)) {
        next.recurrence = '문제 발생 빈도를 선택해 주세요.';
      }
    }
    if (isPaymentProblem) {
      if (!occurredAt) next.occurredAt = '문제가 발생한 날짜와 시간을 입력해 주세요.';
      if (!actualBehavior.trim()) next.actualBehavior = '실제로 발생한 상황을 입력해 주세요.';
      else if (actualBehavior.length > 5000) next.actualBehavior = '실제로 발생한 상황은 5,000자 이하로 입력해 주세요.';
      if (displayedMessage.length > 5000) next.displayedMessage = '화면에 표시된 메시지는 5,000자 이하로 입력해 주세요.';
      if (paymentRequired && !paymentId) next.paymentId = '문제가 발생한 결제를 선택해 주세요.';
      if (!paymentRequired) {
        const hasTarget =
          attemptedPaymentKind === 'membership'
            ? attemptedFeatureKeys.length > 0
            : Boolean(selectedSite && (!needsSeries || selectedSeriesId) && (!needsPost || selectedPostId));
        if (!hasTarget) next.attemptedPayment = '결제하려던 항목을 선택해 주세요.';
        if (attemptedPaymentKind === 'donation' && !parseCurrencyInput(attemptedAmount)) {
          next.attemptedPayment = '후원하려던 금액을 입력해 주세요.';
        }
      }
    }
    if (isMinorCancellation && !paymentId) next.paymentId = '청약취소를 요청할 결제를 선택해 주세요.';
    return next;
  }

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((current) => ({ ...current, [field]: '' }));
  }

  function showTargetLookupError(message: string, isUnknown = false) {
    setError(message);
    setErrorDialog({
      title: isUnknown ? null : '결제 대상 확인',
      messages: [message],
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inquiryUnavailableReason) return;
    if (!event.currentTarget.reportValidity()) return;
    setError('');
    setErrorDialog(null);
    const nextFieldErrors = validateFields();
    const messages = Object.values(nextFieldErrors).filter((message): message is string => Boolean(message));
    setFieldErrors(nextFieldErrors);
    if (messages.length) {
      setErrorDialog({ title: '문의 내용 확인', messages });
      return;
    }
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
          attemptedPaymentKind,
          attemptedPaymentSubtype,
          attemptedMembershipType,
          attemptedFeatureKeys,
          attemptedSiteId: selectedSite?.id,
          attemptedSeriesId: selectedSeriesId || undefined,
          attemptedPostId: selectedPostId || undefined,
          attemptedAmount: attemptedAmount ? parseCurrencyInput(attemptedAmount) : undefined,
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
        errors?: string[];
        fieldErrors?: FieldErrors;
      } | null;

      if (!response.ok || !result?.inquiry) {
        if (response.status >= 500 || !result?.error) {
          setErrorDialog({ title: null, messages: ['처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'] });
        } else {
          const responseFieldErrors = result.fieldErrors ?? {};
          setFieldErrors(responseFieldErrors);
          setErrorDialog({
            title: '문의 내용 확인',
            messages: [...new Set([...(result.errors ?? []), result.error].filter(Boolean))],
          });
        }
        setIsSubmitting(false);
        return;
      }

      if (evidence && (isBug || isPaymentProblem)) {
        const formData = new FormData();
        formData.set('file', evidence);
        const uploadResponse = await fetch(`/api/concierge/contact/inquiries/${result.inquiry.id}/evidence`, {
          method: 'POST',
          body: formData,
        });
        await uploadResponse.json().catch(() => null);
        if (!uploadResponse.ok) {
          router.push('/concierge/contact/inquiries/done?attachment=failed');
          return;
        }
      }

      router.push('/concierge/contact/inquiries/done');
    } catch {
      setErrorDialog({ title: null, messages: ['인터넷 연결을 확인한 뒤 다시 시도해 주세요.'] });
      setIsSubmitting(false);
    }
  }

  function chooseEvidence(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    setError('');
    if (selectedFile && !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(selectedFile.type)) {
      setEvidence(null);
      const message = '첨부 파일은 PDF, JPG, PNG 또는 WEBP 파일만 등록할 수 있습니다.';
      setError(message);
      setErrorDialog({ title: '첨부 파일 확인', messages: [message] });
      event.target.value = '';
      return;
    }
    if (selectedFile && selectedFile.size > 1024 * 1024) {
      setEvidence(null);
      const message = '첨부 파일은 1MB 이하만 가능합니다.';
      setError(message);
      setErrorDialog({ title: '첨부 파일 확인', messages: [message] });
      event.target.value = '';
      return;
    }
    setEvidence(selectedFile);
  }

  function removeEvidence() {
    setEvidence(null);
    if (evidenceInputRef.current) evidenceInputRef.current.value = '';
  }

  function resetAttemptedTarget() {
    setAttemptedPaymentSubtype('');
    setAttemptedFeatureKeys([]);
    setSiteQuery('');
    setSiteResults([]);
    setSelectedSite(null);
    setTargetOptions([]);
    setSelectedSeriesId('');
    setPostQuery('');
    setPostResults([]);
    setSelectedPostId('');
    setAttemptedAmount('');
  }

  async function searchSites() {
    if (!siteQuery.trim()) return;
    setSearchingTargets(true);
    setError('');
    try {
      const response = await fetch(
        `/api/concierge/contact/payment-targets?scope=sites&q=${encodeURIComponent(siteQuery.trim())}&subtype=${encodeURIComponent(attemptedPaymentSubtype)}`,
        { cache: 'no-store' },
      );
      const result = (await response.json().catch(() => null)) as { items?: TargetOption[]; error?: string } | null;
      if (!response.ok) {
        showTargetLookupError(result?.error ?? '사이트를 검색하지 못했습니다.', response.status >= 500 || !result?.error);
      } else {
        setSiteResults(result?.items ?? []);
      }
    } catch {
      showTargetLookupError('인터넷 연결을 확인한 뒤 다시 시도해 주세요.', true);
    } finally {
      setSearchingTargets(false);
    }
  }

  async function selectSite(site: TargetOption) {
    setSelectedSite(site);
    setSelectedSeriesId('');
    setSelectedPostId('');
    setPostResults([]);
    if (
      attemptedPaymentSubtype === 'site_subscription' ||
      attemptedPaymentSubtype === 'site_donation' ||
      attemptedPaymentKind === 'membership'
    ) {
      setTargetOptions([]);
      return;
    }
    setSearchingTargets(true);
    try {
      const response = await fetch(
        `/api/concierge/contact/payment-targets?scope=series&siteId=${encodeURIComponent(site.id)}`,
        { cache: 'no-store' },
      );
      const result = (await response.json().catch(() => null)) as { items?: TargetOption[]; error?: string } | null;
      if (!response.ok) {
        showTargetLookupError(result?.error ?? '결제 대상을 불러오지 못했습니다.', response.status >= 500 || !result?.error);
      } else {
        setTargetOptions(result?.items ?? []);
      }
    } catch {
      showTargetLookupError('인터넷 연결을 확인한 뒤 다시 시도해 주세요.', true);
    } finally {
      setSearchingTargets(false);
    }
  }

  async function searchPosts() {
    if (!selectedSite || !selectedSeriesId || !postQuery.trim()) return;
    setSearchingTargets(true);
    setError('');
    const params = new URLSearchParams({
      scope: 'posts',
      siteId: selectedSite.id,
      seriesId: selectedSeriesId,
      q: postQuery.trim(),
    });
    try {
      const response = await fetch(`/api/concierge/contact/payment-targets?${params}`, { cache: 'no-store' });
      const result = (await response.json().catch(() => null)) as { items?: TargetOption[]; error?: string } | null;
      if (!response.ok) {
        showTargetLookupError(result?.error ?? '연재글을 검색하지 못했습니다.', response.status >= 500 || !result?.error);
      } else {
        setPostResults(result?.items ?? []);
      }
    } catch {
      showTargetLookupError('인터넷 연결을 확인한 뒤 다시 시도해 주세요.', true);
    } finally {
      setSearchingTargets(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Stack direction="column" gap={3}>
        <div className="paper">
          {isAutoMinorCancellation ? (
            <>
              <Stack gap={1}>
                <Typography variant="subtitle2">문의 유형</Typography>
                <Typography>미성년자 결제 청약취소</Typography>
              </Stack>
              <Stack gap={1}>
                <Typography variant="subtitle2">세부 유형</Typography>
                <Typography>미성년자 결제 청약취소</Typography>
              </Stack>
            </>
          ) : (
            <>
              <Stack gap={1}>
                <Typography variant="subtitle2">문의 유형</Typography>
                <TextField
                  select
                  fullWidth
                  size="small"
                  value={inquiryType}
                  slotProps={{ input: { startAdornment: <SelectCheckAdornment /> } }}
                  onChange={(event) => {
                    const next = event.target.value as InquiryType;
                    setInquiryType(next);
                    setInquirySubtype(inquirySubtypes[next][0].value);
                    setPaymentId('');
                    setFieldErrors({});
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
                  slotProps={{ input: { startAdornment: <SelectCheckAdornment /> } }}
                  onChange={(event) => {
                    setInquirySubtype(event.target.value);
                    setPaymentId('');
                    setFieldErrors({});
                  }}
                >
                  {inquirySubtypes[inquiryType].map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </>
          )}
          {isMinorCancellation ? (
            <Stack gap={2}>
              <p className="alert info">
                <InfoOutlineRoundedIcon />
                <span>청약취소를 신청하면 신청 시각부터 15일 동안 다른 결제 건의 청약취소를 신청할 수 없습니다.</span>
              </p>
              {isCancellationBlocked ? (
                <p className="alert warning">
                  <WarningAmberRoundedIcon />
                  <span>다른 결제 건은 {cancellationAvailableAtLabel}부터 신청할 수 있습니다.</span>
                </p>
              ) : paymentLoadError ||
                (isAutoMinorCancellation ? !selectedCancellationPayment : !cancellationPayments.length) ? (
                <p className="alert warning">
                  <WarningAmberRoundedIcon />
                  <span>{paymentLoadError || '청약취소를 신청할 수 없는 결제입니다.'}</span>
                </p>
              ) : isAutoMinorCancellation && selectedCancellationPayment ? (
                <Stack gap={1}>
                  <Typography variant="subtitle2">청약취소를 요청할 결제</Typography>
                  <Typography>{selectedCancellationPayment.label}</Typography>
                </Stack>
              ) : cancellationPayments.length ? (
                <Stack>
                  <Typography variant="subtitle2">청약취소를 요청할 결제</Typography>
                  <RadioGroup
                    value={paymentId}
                    onChange={(event) => {
                      setPaymentId(event.target.value);
                      setFieldErrors((current) => ({ ...current, paymentId: '' }));
                    }}
                  >
                    {cancellationPayments.map((payment) => (
                      <FormControlLabel key={payment.id} value={payment.id} control={<Radio />} label={payment.label} />
                    ))}
                  </RadioGroup>
                  {fieldErrors.paymentId ? <p className="alert popup-error">{fieldErrors.paymentId}</p> : null}
                </Stack>
              ) : null}
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
                    <>
                      <RadioGroup
                        value={paymentId}
                        onChange={(event) => {
                          setPaymentId(event.target.value);
                          setFieldErrors((current) => ({ ...current, paymentId: '' }));
                        }}
                      >
                        {payments.map((payment) => (
                          <FormControlLabel
                            key={payment.id}
                            value={payment.id}
                            control={<Radio />}
                            label={payment.label}
                          />
                        ))}
                      </RadioGroup>
                      {fieldErrors.paymentId ? <p className="alert popup-error">{fieldErrors.paymentId}</p> : null}
                    </>
                  ) : null}
                </Stack>
              ) : (
                <Stack gap={2}>
                  <Stack gap={1}>
                    <Typography variant="subtitle2">결제하려던 항목</Typography>
                    <RadioGroup
                      row
                      value={attemptedPaymentKind}
                      onChange={(event) => {
                        const kind = event.target.value as AttemptedPaymentKind;
                        setAttemptedPaymentKind(kind);
                        resetAttemptedTarget();
                        if (kind === 'subscription') setAttemptedPaymentSubtype('site_subscription');
                        if (kind === 'donation') setAttemptedPaymentSubtype('site_donation');
                        if (kind === 'post_purchase') setAttemptedPaymentSubtype('post_purchase');
                      }}
                    >
                      {attemptedPaymentKinds.map((option) => (
                        <FormControlLabel
                          key={option.value}
                          value={option.value}
                          control={<Radio />}
                          label={option.label}
                        />
                      ))}
                    </RadioGroup>
                  </Stack>

                  {attemptedPaymentKind === 'membership' ? (
                    <>
                      <Stack gap={1}>
                        <Typography variant="subtitle2">멤버십 종류</Typography>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          value={attemptedMembershipType}
                          slotProps={{ input: { startAdornment: <SelectCheckAdornment /> } }}
                          onChange={(event) => {
                            setAttemptedMembershipType(event.target.value as MembershipType);
                            setAttemptedFeatureKeys([]);
                          }}
                        >
                          {membershipTypes.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Stack>
                      <Stack gap={1}>
                        <Typography variant="subtitle2">선택했던 기능</Typography>
                        {MEMBERSHIP_FEATURES.filter((feature) => {
                          if (attemptedMembershipType === 'all_in_one')
                            return feature.group === 'owner' || feature.group === 'creator';
                          return feature.group === attemptedMembershipType;
                        }).map((feature) => (
                          <FormControlLabel
                            key={feature.key}
                            control={
                              <Checkbox
                                checked={attemptedFeatureKeys.includes(feature.key)}
                                onChange={(_, checked) =>
                                  setAttemptedFeatureKeys((current) =>
                                    checked ? [...current, feature.key] : current.filter((key) => key !== feature.key),
                                  )
                                }
                              />
                            }
                            label={feature.label}
                          />
                        ))}
                      </Stack>
                    </>
                  ) : null}

                  {attemptedPaymentKind === 'subscription' || attemptedPaymentKind === 'donation' ? (
                    <Stack gap={1}>
                      <Typography variant="subtitle2">
                        {attemptedPaymentKind === 'subscription' ? '구독 종류' : '후원 종류'}
                      </Typography>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        value={attemptedPaymentSubtype}
                        slotProps={{ input: { startAdornment: <SelectCheckAdornment /> } }}
                        onChange={(event) => {
                          setAttemptedPaymentSubtype(event.target.value);
                          setSelectedSite(null);
                          setTargetOptions([]);
                          setSelectedSeriesId('');
                        }}
                      >
                        {(attemptedPaymentKind === 'subscription' ? subscriptionTypes : donationTypes).map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>
                  ) : null}

                  {needsSite ? (
                    <Stack gap={1}>
                      <Typography variant="subtitle2">사이트 검색</Typography>
                      <Stack direction="row" gap={1}>
                        <TextField
                          fullWidth
                          size="small"
                          value={siteQuery}
                          onChange={(event) => setSiteQuery(event.target.value)}
                          onKeyDown={(event) =>
                            runInputAdornmentAction(event, searchSites, !siteQuery.trim() || searchingTargets)
                          }
                          placeholder="사이트 이름의 일부를 입력해 주세요"
                          slotProps={{
                            htmlInput: { maxLength: 100 },
                            input: {
                              endAdornment: (
                                <InputAdornment position="end">
                                  <button
                                    type="button"
                                    className="button small action"
                                    disabled={!siteQuery.trim() || searchingTargets}
                                    onClick={() => void searchSites()}
                                  >
                                    검색
                                  </button>
                                </InputAdornment>
                              ),
                            },
                          }}
                        />
                      </Stack>
                      {siteResults.length ? (
                        <RadioGroup
                          value={selectedSite?.id ?? ''}
                          onChange={(event) => {
                            const site = siteResults.find((item) => item.id === event.target.value);
                            if (site) void selectSite(site);
                          }}
                        >
                          {siteResults.map((site) => (
                            <FormControlLabel key={site.id} value={site.id} control={<Radio />} label={site.label} />
                          ))}
                        </RadioGroup>
                      ) : null}
                    </Stack>
                  ) : null}

                  {selectedSite && needsSeries ? (
                    <Stack gap={1}>
                      <Typography variant="subtitle2">연재 선택</Typography>
                      <TextField
                        select
                        required
                        fullWidth
                        size="small"
                        value={selectedSeriesId}
                        slotProps={{ input: { startAdornment: <SelectCheckAdornment /> } }}
                        onChange={(event) => {
                          setSelectedSeriesId(event.target.value);
                          setSelectedPostId('');
                          setPostResults([]);
                        }}
                      >
                        {targetOptions.map((option) => (
                          <MenuItem key={option.id} value={option.id}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>
                  ) : null}

                  {needsPost && selectedSite && selectedSeriesId ? (
                    <Stack gap={1}>
                      <Typography variant="subtitle2">연재글 제목 검색</Typography>
                      <Stack direction="row" gap={1}>
                        <TextField
                          fullWidth
                          size="small"
                          value={postQuery}
                          onChange={(event) => setPostQuery(event.target.value)}
                          onKeyDown={(event) =>
                            runInputAdornmentAction(event, searchPosts, !postQuery.trim() || searchingTargets)
                          }
                          placeholder="연재글 제목의 일부를 입력해 주세요"
                          slotProps={{
                            htmlInput: { maxLength: 200 },
                            input: {
                              endAdornment: (
                                <InputAdornment position="end">
                                  <button
                                    type="button"
                                    className="button small action"
                                    disabled={!postQuery.trim() || searchingTargets}
                                    onClick={() => void searchPosts()}
                                  >
                                    검색
                                  </button>
                                </InputAdornment>
                              ),
                            },
                          }}
                        />
                      </Stack>
                      {postResults.length ? (
                        <RadioGroup value={selectedPostId} onChange={(event) => setSelectedPostId(event.target.value)}>
                          {postResults.map((post) => (
                            <FormControlLabel
                              key={post.id}
                              value={post.id}
                              control={<Radio />}
                              label={`${post.label}${post.description ? ` / ${formatDateTimeDetail(post.description)}` : ''}`}
                            />
                          ))}
                        </RadioGroup>
                      ) : null}
                    </Stack>
                  ) : null}

                  {attemptedPaymentKind === 'donation' ? (
                    <Stack gap={1}>
                      <Typography variant="subtitle2">후원하려던 금액</Typography>
                      <TextField
                        required
                        fullWidth
                        size="small"
                        value={attemptedAmount}
                        onChange={(event) => setAttemptedAmount(formatCurrencyInput(event.target.value))}
                        inputMode="numeric"
                        slotProps={{
                          input: {
                            endAdornment: <InputAdornment position="end">원</InputAdornment>,
                          },
                        }}
                      />
                    </Stack>
                  ) : null}
                </Stack>
              )}
              {fieldErrors.attemptedPayment ? <p className="alert popup-error">{fieldErrors.attemptedPayment}</p> : null}
              {inquiryUnavailableReason ? (
                <p className="alert warning">
                  <WarningAmberRoundedIcon />
                  <span>{inquiryUnavailableReason}</span>
                </p>
              ) : (
                <>
                  <Stack gap={1}>
                    <Typography variant="subtitle2">문제가 발생한 날짜와 시간</Typography>
                    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                      <DateTimePicker
                        value={occurredAt}
                        onChange={(value) => {
                          setOccurredAt(value);
                          setFieldErrors((current) => ({ ...current, occurredAt: '' }));
                        }}
                        ampm={false}
                        views={['year', 'month', 'day', 'hours', 'minutes']}
                        format="yyyy년 MM월 dd일 HH시 mm분"
                        slotProps={{
                          textField: {
                            required: true,
                            fullWidth: true,
                            size: 'small',
                            error: Boolean(fieldErrors.occurredAt),
                            helperText: fieldErrors.occurredAt,
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
                      onChange={(event) => {
                        setDisplayedMessage(event.target.value);
                        clearFieldError('displayedMessage');
                      }}
                      error={Boolean(fieldErrors.displayedMessage)}
                      helperText={fieldErrors.displayedMessage}
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
                      onChange={(event) => {
                        setActualBehavior(event.target.value);
                        setFieldErrors((current) => ({ ...current, actualBehavior: '' }));
                      }}
                      error={Boolean(fieldErrors.actualBehavior)}
                      helperText={fieldErrors.actualBehavior}
                      slotProps={{ htmlInput: { maxLength: 5000 } }}
                    />
                  </Stack>
                </>
              )}
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
                  onChange={(event) => {
                    setPageUrl(event.target.value);
                    clearFieldError('pageUrl');
                  }}
                  error={Boolean(fieldErrors.pageUrl)}
                  helperText={fieldErrors.pageUrl}
                  slotProps={{ htmlInput: { maxLength: 2000 } }}
                />
              </Stack>
              <Stack gap={1}>
                <Typography variant="subtitle2">문제가 발생한 날짜와 시간</Typography>
                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                  <DateTimePicker
                    value={occurredAt}
                    onChange={(value) => {
                      setOccurredAt(value);
                      clearFieldError('occurredAt');
                    }}
                    ampm={false}
                    views={['year', 'month', 'day', 'hours', 'minutes']}
                    format="yyyy년 MM월 dd일 HH시 mm분"
                    slotProps={{
                      textField: {
                        required: true,
                        fullWidth: true,
                        size: 'small',
                        error: Boolean(fieldErrors.occurredAt),
                        helperText: fieldErrors.occurredAt,
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
                  onChange={(event) => {
                    setAttemptedAction(event.target.value);
                    clearFieldError('attemptedAction');
                  }}
                  error={Boolean(fieldErrors.attemptedAction)}
                  helperText={fieldErrors.attemptedAction}
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
                  onChange={(event) => {
                    setActualBehavior(event.target.value);
                    clearFieldError('actualBehavior');
                  }}
                  error={Boolean(fieldErrors.actualBehavior)}
                  helperText={fieldErrors.actualBehavior}
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
                  slotProps={{ input: { startAdornment: <SelectCheckAdornment /> } }}
                  onChange={(event) => {
                    setRecurrence(event.target.value);
                    clearFieldError('recurrence');
                  }}
                  error={Boolean(fieldErrors.recurrence)}
                  helperText={fieldErrors.recurrence}
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
                      onChange={(event) => {
                        setErrorMessage(event.target.value);
                        clearFieldError('errorMessage');
                      }}
                      error={Boolean(fieldErrors.errorMessage)}
                      helperText={fieldErrors.errorMessage}
                      slotProps={{ htmlInput: { maxLength: 5000 } }}
                />
              </Stack>
            </Stack>
          ) : null}
          {isBug || (isPaymentProblem && !inquiryUnavailableReason) ? (
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
          {!isBug && !isPaymentProblem && !inquiryUnavailableReason ? (
            <Stack gap={3}>
              <Stack gap={1}>
                <Typography variant="subtitle2">제목</Typography>
                <TextField
                  required
                  fullWidth
                  size="small"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    clearFieldError('title');
                  }}
                  error={Boolean(fieldErrors.title)}
                  helperText={fieldErrors.title}
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
                  onChange={(event) => {
                    setContent(event.target.value);
                    clearFieldError('content');
                  }}
                  error={Boolean(fieldErrors.content)}
                  helperText={fieldErrors.content}
                  slotProps={{ htmlInput: { maxLength: 10000 } }}
                />
              </Stack>
            </Stack>
          ) : null}
          {error && !inquiryUnavailableReason ? (
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
          {!inquiryUnavailableReason ? (
            <button type="submit" className="button medium submit" disabled={isSubmitting}>
              {isSubmitting ? '접수 중' : '문의 접수'}
            </button>
          ) : null}
        </Stack>
      </Stack>
      <FormErrorDialog
        open={Boolean(errorDialog)}
        title={errorDialog?.title ?? null}
        messages={errorDialog?.messages ?? []}
        onClose={() => setErrorDialog(null)}
      />
    </form>
  );
}
