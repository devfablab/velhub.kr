'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {
  Checkbox,
  FormControlLabel,
  InputAdornment,
  MenuItem,
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
import Anchor from '@/components/Anchor';

type PaymentRow = {
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
  const needsSite = attemptedPaymentKind !== 'membership';
  const needsSeries =
    attemptedPaymentSubtype === 'series_subscription' ||
    attemptedPaymentSubtype === 'series_donation' ||
    attemptedPaymentKind === 'post_purchase';
  const needsPost = attemptedPaymentKind === 'post_purchase';
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
        await uploadResponse.json().catch(() => null);
        if (!uploadResponse.ok) {
          router.push(`/concierge/contact/inquiries/${result.inquiry.id}?attachment=failed`);
          return;
        }
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
    const response = await fetch(
      `/api/concierge/contact/payment-targets?scope=sites&q=${encodeURIComponent(siteQuery.trim())}&subtype=${encodeURIComponent(attemptedPaymentSubtype)}`,
      { cache: 'no-store' },
    );
    const result = (await response.json().catch(() => null)) as { items?: TargetOption[]; error?: string } | null;
    if (!response.ok) setError(result?.error ?? '사이트를 검색하지 못했습니다.');
    else setSiteResults(result?.items ?? []);
    setSearchingTargets(false);
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
    const response = await fetch(
      `/api/concierge/contact/payment-targets?scope=series&siteId=${encodeURIComponent(site.id)}`,
      { cache: 'no-store' },
    );
    const result = (await response.json().catch(() => null)) as { items?: TargetOption[]; error?: string } | null;
    if (!response.ok) setError(result?.error ?? '결제 대상을 불러오지 못했습니다.');
    else setTargetOptions(result?.items ?? []);
    setSearchingTargets(false);
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
    const response = await fetch(`/api/concierge/contact/payment-targets?${params}`, { cache: 'no-store' });
    const result = (await response.json().catch(() => null)) as { items?: TargetOption[]; error?: string } | null;
    if (!response.ok) setError(result?.error ?? '연재글을 검색하지 못했습니다.');
    else setPostResults(result?.items ?? []);
    setSearchingTargets(false);
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
                          placeholder="연재글 제목의 일부를 입력해 주세요"
                          slotProps={{ htmlInput: { maxLength: 200 } }}
                        />
                        <button
                          type="button"
                          className="button small action"
                          disabled={!postQuery.trim() || searchingTargets}
                          onClick={() => void searchPosts()}
                        >
                          검색
                        </button>
                      </Stack>
                      {postResults.length ? (
                        <RadioGroup value={selectedPostId} onChange={(event) => setSelectedPostId(event.target.value)}>
                          {postResults.map((post) => (
                            <FormControlLabel
                              key={post.id}
                              value={post.id}
                              control={<Radio />}
                              label={`${post.label}${post.description ? ` / ${new Date(post.description).toLocaleDateString('ko-KR')}` : ''}`}
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
