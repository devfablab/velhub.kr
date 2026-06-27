'use client';

import { type KeyboardEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import * as PortOne from '@portone/browser-sdk/v2';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import {
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { formatDate, formatDateSimple, normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';
import BillingMethodButton from '@/components/service/common/BillingMethodButton';

type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'scheduled_cancel' | 'canceled' | 'expired';
type PaymentStatus = 'paid' | 'failed' | 'partially_refunded' | 'refunded';
type BillingDialogType = 'cancel' | 'refund' | 'retry' | null;

type PlanBillingResponse = {
  site?: {
    id: string;
    siteKey: string;
    siteLabel: string | null;
  };
  plan?: {
    id: string;
    name: string | null;
    price: number;
  } | null;
  subscription?: {
    id: string;
    status: SubscriptionStatus;
    price: number;
    trial_started_at: string | null;
    trial_ends_at: string | null;
    current_period_start: string;
    current_period_end: string;
    next_billing_at: string | null;
    past_due_started_at: string | null;
    canceled_at: string | null;
    expired_at: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  payments?: {
    id: string;
    order_no: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    failure_message: string | null;
    failure_stage: string | null;
    refundable_until: string | null;
    approved_at: string | null;
    refunded_at: string | null;
    created_at: string;
  }[];
  billingMethods?: {
    id: string;
    provider: string;
    card_company: string;
    card_number_masked: string;
    owner_type: string;
    card_type: string;
    is_default: boolean;
    created_at: string;
    updated_at: string | null;
  }[];
  error?: string;
};

type PaymentItem = NonNullable<PlanBillingResponse['payments']>[number];

type PlanBillingStartResponse =
  | {
      amount: number | undefined;
      mode: 'billing_auth';
      storeId: string;
      channelKey: string;
      customerKey: string;
      customerName: string;
      orderNo: string;
      orderName: string;
      successUrl: string;
      failUrl: string;
    }
  | {
      mode: 'direct_billing';
      ok: true;
      subscriptionId: string;
    }
  | {
      mode: 'trial_started';
      ok: true;
      subscriptionId: string;
    }
  | {
      error: string;
    };

type PlanBillingCancelResponse =
  | {
      ok: true;
      mode: 'canceled_without_payment' | 'cancel_scheduled' | 'full_refund' | 'partial_refund';
      refundAmount: number;
      retainedAmount: number;
      usedDays?: number;
    }
  | {
      error: string;
    };

type PlanBillingResumeResponse =
  | {
      ok: true;
      mode: 'resume_scheduled_cancel';
      nextBillingAt: string;
    }
  | {
      error: string;
    };

function formatPrice(price: number | null | undefined) {
  if (typeof price !== 'number') {
    return '-';
  }

  return `${price.toLocaleString('ko-KR')} 원`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatCardNumber(cardNumberMasked: string | null | undefined) {
  const normalizedCardNumber = normalizeText(cardNumberMasked).replace(/\D/g, '');

  if (normalizedCardNumber.length < 4) {
    return '카드번호 확인 필요';
  }

  return `${normalizedCardNumber.slice(0, 4)} ••••`;
}

function getCardCompanyText(cardCompany: string | null | undefined) {
  const normalizedCardCompany = normalizeText(cardCompany);

  const cardCompanyTextMap: Record<string, string> = {
    HYUNDAI_CARD: '현대카드',
    SHINHAN_CARD: '신한카드',
    SAMSUNG_CARD: '삼성카드',
    KB_CARD: '국민카드',
    KOOKMIN_CARD: '국민카드',
    LOTTE_CARD: '롯데카드',
    HANA_CARD: '하나카드',
    WOORI_CARD: '우리카드',
    BC_CARD: 'BC카드',
    NH_CARD: 'NH농협카드',
    NONGHYUP_CARD: 'NH농협카드',
    CITI_CARD: '씨티카드',
    KAKAOBANK_CARD: '카카오뱅크카드',
    K_BANK_CARD: '케이뱅크카드',
    TOSSBANK_CARD: '토스뱅크카드',
  };

  return (cardCompanyTextMap[normalizedCardCompany] ?? normalizedCardCompany) || '카드';
}

function getCardTypeText(cardType: string | null | undefined) {
  const normalizedCardType = normalizeText(cardType);

  const cardTypeTextMap: Record<string, string> = {
    CREDIT: '신용카드',
    DEBIT: '체크카드',
    GIFT: '기프트카드',
  };

  return (cardTypeTextMap[normalizedCardType] ?? normalizedCardType) || '카드 유형 확인 필요';
}

function getOwnerTypeText(ownerType: string | null | undefined) {
  const normalizedOwnerType = normalizeText(ownerType);

  const ownerTypeTextMap: Record<string, string> = {
    PERSONAL: '개인카드',
    CORPORATE: '법인카드',
  };

  return (ownerTypeTextMap[normalizedOwnerType] ?? normalizedOwnerType) || '소유 유형 확인 필요';
}

function getSubscriptionStatusText(status: SubscriptionStatus) {
  switch (status) {
    case 'trialing':
      return '무료 기간';
    case 'active':
      return '정상 이용 중';
    case 'past_due':
      return '결제 유예 중';
    case 'scheduled_cancel':
      return '취소 예정';
    case 'canceled':
      return '구독 취소';
    case 'expired':
      return '이용 만료';
    default:
      return '상태 확인 필요';
  }
}

function getPaymentStatusText(status: string, failureStage?: string | null) {
  if (status === 'failed') {
    if (failureStage === 'billing_auth') {
      return '결제수단 등록 실패';
    }

    if (failureStage === 'auto_billing' || failureStage === 'plan_billing_check') {
      return '자동결제 실패';
    }

    return '결제 실패';
  }

  switch (status) {
    case 'paid':
      return '결제 성공';
    case 'partially_refunded':
      return '부분 환불';
    case 'refunded':
      return '전액 환불';
    default:
      return status;
  }
}

function getCancelSuccessMessage(result: Exclude<PlanBillingCancelResponse, { error: string }>) {
  switch (result.mode) {
    case 'canceled_without_payment':
      return '요금제 구독이 취소되었습니다.';
    case 'cancel_scheduled':
      return '요금제 구독 취소가 예약되었습니다. 현재 이용 기간은 유지됩니다.';
    case 'full_refund':
      return '요금제 구독이 취소되고 전액 환불되었습니다.';
    case 'partial_refund':
      return `요금제 구독이 취소되고 ${formatPrice(result.refundAmount)} 환불되었습니다.`;
    default:
      return '요금제 구독 취소가 처리되었습니다.';
  }
}

function getBillingDialogTitle(dialogType: BillingDialogType) {
  switch (dialogType) {
    case 'cancel':
      return '구독을 취소할까요?';
    case 'refund':
      return '환불을 진행할까요?';
    case 'retry':
      return '결제를 다시 시도할까요?';
    default:
      return '';
  }
}

function getBillingDialogMessage(dialogType: BillingDialogType) {
  switch (dialogType) {
    case 'cancel':
      return '구독을 취소하면 다음 결제부터 요금이 청구되지 않습니다.';
    case 'refund':
      return '환불이 처리되면 현재 이용이 즉시 종료될 수 있습니다.';
    case 'retry':
      return '등록된 결제수단으로 다시 결제를 시도합니다.';
    default:
      return '';
  }
}

function getBillingDialogConfirmText(dialogType: BillingDialogType) {
  switch (dialogType) {
    case 'cancel':
      return '취소하기';
    case 'refund':
      return '환불받기';
    case 'retry':
      return '결제 다시 시도';
    default:
      return '확인';
  }
}

function getPlanSubscriptionButtonText({
  subscription,
  hasBillingMethod,
}: {
  subscription: PlanBillingResponse['subscription'];
  hasBillingMethod: boolean;
}) {
  if (subscription) {
    return '다시 구독하기';
  }

  if (hasBillingMethod) {
    return '무료체험 시작하기';
  }

  return '결제수단 등록하기';
}

function PaymentDetail({ payment }: { payment: PaymentItem }) {
  return (
    <Stack gap={2}>
      <Stack gap={0.5}>
        <Typography variant="subtitle2">주문번호</Typography>
        <Typography variant="body2">{payment.order_no}</Typography>
      </Stack>

      <Stack gap={0.5}>
        <Typography variant="subtitle2">금액</Typography>
        <Typography variant="body2">{formatPrice(payment.amount)}</Typography>
      </Stack>

      <Stack gap={0.5}>
        <Typography variant="subtitle2">결제일</Typography>
        <Typography variant="body2">{formatDateTime(payment.approved_at ?? payment.created_at)}</Typography>
      </Stack>

      <Stack gap={0.5}>
        <Typography variant="subtitle2">상태</Typography>
        <Typography variant="body2">{getPaymentStatusText(payment.status, payment.failure_stage)}</Typography>
      </Stack>

      {payment.refunded_at ? (
        <Stack gap={0.5}>
          <Typography variant="subtitle2">환불일</Typography>
          <Typography variant="body2">{formatDateTime(payment.refunded_at)}</Typography>
        </Stack>
      ) : null}
    </Stack>
  );
}

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [billingData, setBillingData] = useState<PlanBillingResponse | null>(null);
  const [billingDialogType, setBillingDialogType] = useState<BillingDialogType>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null);

  const loadData = useCallback(async () => {
    try {
      setErrorMessage('');

      const response = await fetch(`/api/manage/payments/plan-billing?siteName=${siteName}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as PlanBillingResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '결제 정보를 불러오지 못했습니다.');
      }

      setBillingData(result);

      return true;
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '결제 정보를 불러오지 못했습니다.');
      } else {
        setErrorMessage('결제 정보를 불러오지 못했습니다.');
      }

      return false;
    } finally {
      setIsLoading(false);
    }
  }, [siteName]);

  useEffect(() => {
    if (!siteName) {
      setErrorMessage('siteName이 유효하지 않습니다.');
      setIsLoading(false);
      return;
    }

    void loadData();
  }, [loadData, siteName]);

  async function handleBillingAuth() {
    try {
      setIsProcessing(true);
      setErrorMessage('');
      setSuccessMessage('');

      if (!billingData?.site?.id) {
        throw new Error('사이트 정보가 없습니다.');
      }

      const response = await fetch('/api/payments/portone/plan-billing/start', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteId: billingData.site.id,
          orderName: '데브허브 사이트 요금제 무료체험 시작',
          successUrl: `/${siteName}/manage/payments/billing/success`,
          failUrl: `/${siteName}/manage/payments/billing/fail`,
          purpose: 'plan_subscription',
        }),
      });

      const result = (await response.json()) as PlanBillingStartResponse;

      if (!response.ok) {
        throw new Error('error' in result ? result.error : '요금제 구독을 시작하지 못했습니다.');
      }

      if ('error' in result) {
        throw new Error(result.error || '요금제 구독을 시작하지 못했습니다.');
      }

      const isLoaded = await loadData();

      if (isLoaded) {
        if (result.mode === 'trial_started') {
          setSuccessMessage('무료체험이 시작되었습니다.');
        } else {
          setSuccessMessage('요금제 구독이 시작되었습니다.');
        }
      }
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '요금제 구독을 시작하지 못했습니다.');
      } else {
        setErrorMessage('요금제 구독을 시작하지 못했습니다.');
      }
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleCancelPlanBilling() {
    try {
      setIsProcessing(true);
      setErrorMessage('');
      setSuccessMessage('');

      if (!billingData?.site?.id) {
        throw new Error('사이트 정보가 없습니다.');
      }

      const response = await fetch('/api/payments/portone/plan-billing/cancel', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteId: billingData.site.id,
        }),
      });

      const result = (await response.json()) as PlanBillingCancelResponse;

      if (!response.ok) {
        throw new Error('error' in result ? result.error : '요금제 구독을 취소하지 못했습니다.');
      }

      if ('error' in result) {
        throw new Error(result.error || '요금제 구독을 취소하지 못했습니다.');
      }

      const isLoaded = await loadData();

      if (isLoaded) {
        setSuccessMessage(getCancelSuccessMessage(result));
      }
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '요금제 구독을 취소하지 못했습니다.');
      } else {
        setErrorMessage('요금제 구독을 취소하지 못했습니다.');
      }
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleResumePlanBilling() {
    try {
      setIsProcessing(true);
      setErrorMessage('');
      setSuccessMessage('');

      if (!billingData?.site?.id) {
        throw new Error('사이트 정보가 없습니다.');
      }

      const response = await fetch('/api/payments/portone/plan-billing/resume', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteId: billingData.site.id,
        }),
      });

      const result = (await response.json()) as PlanBillingResumeResponse;

      if (!response.ok) {
        throw new Error('error' in result ? result.error : '요금제 구독 취소를 철회하지 못했습니다.');
      }

      if ('error' in result) {
        throw new Error(result.error || '요금제 구독 취소를 철회하지 못했습니다.');
      }

      const isLoaded = await loadData();

      if (isLoaded) {
        setSuccessMessage('요금제 구독 취소가 철회되었습니다.');
      }
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '요금제 구독 취소를 철회하지 못했습니다.');
      } else {
        setErrorMessage('요금제 구독 취소를 철회하지 못했습니다.');
      }
    } finally {
      setIsProcessing(false);
    }
  }

  function handleCloseBillingDialog() {
    if (isProcessing) {
      return;
    }

    setBillingDialogType(null);
  }

  async function handleConfirmBillingDialog() {
    if (billingDialogType === 'cancel' || billingDialogType === 'refund') {
      setBillingDialogType(null);
      await handleCancelPlanBilling();
      return;
    }

    if (billingDialogType === 'retry') {
      setBillingDialogType(null);
      setErrorMessage('결제 다시 시도 API가 아직 연결되지 않았습니다.');
    }
  }

  function handleOpenPaymentDetail(payment: PaymentItem) {
    setSelectedPayment(payment);
  }

  function handleClosePaymentDetail() {
    setSelectedPayment(null);
  }

  function handlePaymentRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, payment: PaymentItem) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    setSelectedPayment(payment);
  }

  if (isLoading) {
    return (
      <Container pageTitle="결제 관리" pageBack={`/${siteName}/manage`} menu="payments">
        <div className={`container ${styles.container}`}>
          <div className={`${styles.content} content`}>
            <div className={`paper ${styles.paper}`}>
              <div className="loading-container">
                <LoadingIndicator />
              </div>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  const subscription = billingData?.subscription ?? null;
  const payments = billingData?.payments ?? [];
  const billingMethods = billingData?.billingMethods ?? [];

  const latestPaidPayment =
    payments.find((payment) => payment.status === 'paid' || payment.status === 'partially_refunded') ?? null;
  const isScheduledCancel = Boolean(
    subscription?.status === 'scheduled_cancel' || (subscription?.canceled_at && !subscription.expired_at),
  );
  const hasBillingMethod = billingMethods.length > 0;
  const planSubscriptionGuideText = hasBillingMethod
    ? '결제수단이 등록되어 있습니다. 무료체험을 시작하면 사이트가 오픈되고, 무료체험 종료 후 등록된 결제수단으로 자동결제됩니다.'
    : '아직 결제수단이 등록되지 않았습니다. 결제수단을 등록하면 사이트가 오픈되고 무료체험이 적용됩니다.';
  const canRetryPayment = subscription?.status === 'past_due' && hasBillingMethod;
  const canAddBillingMethod = Boolean(
    subscription && subscription.status !== 'canceled' && subscription.status !== 'expired',
  );
  const canRefundSubscription = Boolean(
    subscription &&
    !subscription.canceled_at &&
    subscription.status !== 'canceled' &&
    subscription.status !== 'expired' &&
    latestPaidPayment?.refundable_until &&
    new Date(latestPaidPayment.refundable_until).getTime() > Date.now(),
  );
  const canCancelSubscription = Boolean(
    subscription &&
    !canRefundSubscription &&
    !subscription.canceled_at &&
    subscription.status !== 'trialing' &&
    subscription.status !== 'scheduled_cancel' &&
    subscription.status !== 'canceled' &&
    subscription.status !== 'expired',
  );
  const canResumeSubscription = Boolean(
    subscription &&
    subscription.canceled_at &&
    !subscription.expired_at &&
    subscription.status !== 'canceled' &&
    subscription.status !== 'expired',
  );
  const shouldShowBillingAuthButton =
    !subscription || subscription.status === 'canceled' || subscription.status === 'expired';

  return (
    <Container pageTitle="결제 관리" pageBack={`/${siteName}/manage`} menu="payments">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <Snackbar
            open={Boolean(errorMessage)}
            autoHideDuration={4000}
            message={errorMessage}
            onClose={() => setErrorMessage('')}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'center',
            }}
          />
          <Snackbar
            open={Boolean(successMessage)}
            autoHideDuration={4000}
            message={successMessage}
            onClose={() => setSuccessMessage('')}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'center',
            }}
          />

          <Stack gap={3}>
            <div className={`paper ${styles.paper}`}>
              <Stack gap={1}>
                <Typography variant="subtitle2">요금제 이용 상태</Typography>
                <Stack>
                  <Typography variant="body2">
                    {billingData?.plan?.name} (월 {formatPrice(billingData?.plan?.price)})
                  </Typography>

                  {subscription ? (
                    <Stack>
                      <Typography variant="body2">
                        {getSubscriptionStatusText(subscription.status)} (
                        {formatDateSimple(subscription.current_period_start)} ~{' '}
                        {formatDateSimple(subscription.current_period_end)})
                      </Typography>
                      {isScheduledCancel ? (
                        <p className="alert info">
                          <InfoOutlineRoundedIcon />
                          <span>다음 정기 결제일부턴 결제가 진행되지 않으며, 구독이 자동 종료됩니다.</span>
                        </p>
                      ) : null}
                      {subscription.status === 'past_due' ? (
                        <p className="alert error">
                          <ErrorOutlineRoundedIcon />
                          <span>자동결제에 실패했습니다. 결제수단을 확인하거나 결제를 다시 시도해 주세요.</span>
                        </p>
                      ) : null}
                      {subscription.next_billing_at ? (
                        <Typography variant="body2">
                          {formatDate(subscription.next_billing_at)}에 결제됩니다.
                        </Typography>
                      ) : null}
                    </Stack>
                  ) : (
                    <Typography variant="body2">{planSubscriptionGuideText}</Typography>
                  )}
                </Stack>
                <Stack direction="row" gap={1} flexWrap="wrap">
                  {shouldShowBillingAuthButton ? (
                    hasBillingMethod ? (
                      <button
                        type="button"
                        className="button small submit"
                        onClick={() => {
                          void handleBillingAuth();
                        }}
                        disabled={isProcessing}
                      >
                        {getPlanSubscriptionButtonText({ subscription, hasBillingMethod })}
                      </button>
                    ) : (
                      <BillingMethodButton />
                    )
                  ) : null}

                  {canRetryPayment ? (
                    <button
                      type="button"
                      className="button small submit"
                      onClick={() => setBillingDialogType('retry')}
                      disabled={isProcessing}
                    >
                      결제 다시 시도
                    </button>
                  ) : null}

                  {canRefundSubscription ? (
                    <button
                      type="button"
                      className="button small cancel"
                      onClick={() => setBillingDialogType('refund')}
                      disabled={isProcessing}
                    >
                      환불받기
                    </button>
                  ) : null}

                  {canCancelSubscription ? (
                    <button
                      type="button"
                      className="button small cancel"
                      onClick={() => setBillingDialogType('cancel')}
                      disabled={isProcessing}
                    >
                      취소하기
                    </button>
                  ) : null}

                  {canResumeSubscription ? (
                    <button
                      type="button"
                      className="button small cancel"
                      onClick={() => {
                        void handleResumePlanBilling();
                      }}
                      disabled={isProcessing}
                    >
                      취소 철회하기
                    </button>
                  ) : null}
                </Stack>
              </Stack>
            </div>

            <div className={`paper ${styles.paper}`}>
              <Stack gap={1}>
                <Typography variant="subtitle2">결제 수단</Typography>
                <Stack gap={1}>
                  <Typography variant="body2">자동결제에 사용할 카드를 관리합니다.</Typography>

                  {billingMethods.length ? (
                    <Stack gap={1}>
                      {billingMethods.map((billingMethod) => (
                        <div className={`paper ${styles.paper}`} key={billingMethod.id}>
                          <Stack gap={0.5} direction="row" justifyContent="space-between">
                            <Typography variant="body2">
                              {getCardCompanyText(billingMethod.card_company)} (
                              {getCardTypeText(billingMethod.card_type)} / {getOwnerTypeText(billingMethod.owner_type)}){' '}
                              {formatCardNumber(billingMethod.card_number_masked)}
                            </Typography>
                            {billingMethod.is_default ? (
                              <Chip label="기본" size="small" className="chip success" />
                            ) : null}
                          </Stack>
                        </div>
                      ))}
                    </Stack>
                  ) : (
                    <p className="alert info">
                      <InfoOutlineRoundedIcon />
                      <span>등록된 결제 수단이 없습니다.</span>
                    </p>
                  )}
                </Stack>

                {canAddBillingMethod ? <BillingMethodButton /> : null}
              </Stack>
            </div>

            <div className={`paper ${styles.paper}`}>
              <Stack gap={2}>
                <Typography variant="subtitle2">결제 내역</Typography>

                {payments.length ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>금액</TableCell>
                          <TableCell>결제일</TableCell>
                          <TableCell>상태</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {payments.map((payment) => (
                          <TableRow
                            key={payment.id}
                            hover
                            role="button"
                            tabIndex={0}
                            onClick={() => handleOpenPaymentDetail(payment)}
                            onKeyDown={(event) => handlePaymentRowKeyDown(event, payment)}
                            sx={{ cursor: 'pointer' }}
                          >
                            <TableCell>{formatPrice(payment.amount)}</TableCell>
                            <TableCell>{formatDateTime(payment.approved_at ?? payment.created_at)}</TableCell>
                            <TableCell>{getPaymentStatusText(payment.status, payment.failure_stage)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <p className="alert info">
                    <InfoOutlineRoundedIcon />
                    <span>아직 결제 내역이 없습니다.</span>
                  </p>
                )}
              </Stack>
            </div>
          </Stack>

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={Boolean(billingDialogType)}
              onClose={handleCloseBillingDialog}
              className="VhiDrawer-bottom"
            >
              <h2>{getBillingDialogTitle(billingDialogType)}</h2>
              <button type="button" className="close-button" onClick={handleCloseBillingDialog}>
                <CloseRoundedIcon />
              </button>
              <Stack gap={3}>
                <Typography>{getBillingDialogMessage(billingDialogType)}</Typography>
                <Stack direction="column" gap={1.5}>
                  <button
                    type="button"
                    className="button medium cancel"
                    onClick={handleCloseBillingDialog}
                    disabled={isProcessing}
                  >
                    닫기
                  </button>
                  <button
                    type="button"
                    className="button medium submit"
                    onClick={() => {
                      void handleConfirmBillingDialog();
                    }}
                    disabled={isProcessing}
                  >
                    {getBillingDialogConfirmText(billingDialogType)}
                  </button>
                </Stack>
              </Stack>
            </Drawer>
          ) : (
            <Dialog open={Boolean(billingDialogType)} onClose={handleCloseBillingDialog} className="VhiDialog">
              <DialogTitle>{getBillingDialogTitle(billingDialogType)}</DialogTitle>
              <button type="button" className="close-button" onClick={handleCloseBillingDialog}>
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <Typography>{getBillingDialogMessage(billingDialogType)}</Typography>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="button medium close"
                  onClick={handleCloseBillingDialog}
                  disabled={isProcessing}
                >
                  닫기
                </button>
                <button
                  type="button"
                  className="button medium submit"
                  onClick={() => {
                    void handleConfirmBillingDialog();
                  }}
                  disabled={isProcessing}
                >
                  {getBillingDialogConfirmText(billingDialogType)}
                </button>
              </DialogActions>
            </Dialog>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={Boolean(selectedPayment)}
              onClose={handleClosePaymentDetail}
              className="VhiDrawer-bottom"
            >
              <h2>결제 상세</h2>
              <button type="button" className="close-button" onClick={handleClosePaymentDetail}>
                <CloseRoundedIcon />
              </button>
              <Stack gap={3}>
                {selectedPayment ? <PaymentDetail payment={selectedPayment} /> : null}
                <button type="button" className="button medium submit" onClick={handleClosePaymentDetail}>
                  확인
                </button>
              </Stack>
            </Drawer>
          ) : (
            <Dialog open={Boolean(selectedPayment)} onClose={handleClosePaymentDetail} className="VhiDialog">
              <DialogTitle>결제 상세</DialogTitle>
              <button type="button" className="close-button" onClick={handleClosePaymentDetail}>
                <CloseRoundedIcon />
              </button>
              <DialogContent>{selectedPayment ? <PaymentDetail payment={selectedPayment} /> : null}</DialogContent>
              <DialogActions>
                <button type="button" className="button medium submit" onClick={handleClosePaymentDetail}>
                  확인
                </button>
              </DialogActions>
            </Dialog>
          )}
        </div>
      </div>
    </Container>
  );
}
