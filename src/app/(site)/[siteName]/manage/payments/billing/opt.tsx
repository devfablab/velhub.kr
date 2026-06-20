'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { normalizeText } from '@/lib/utils';
import Container from '../../menu';

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
    card_company: string | null;
    card_company_code: string | null;
    card_number_masked: string | null;
    owner_type: string | null;
    card_type: string | null;
    is_default: boolean;
    created_at: string;
    updated_at: string | null;
  }[];
  error?: string;
};

type PlanBillingStartResponse =
  | {
      mode: 'billing_auth';
      clientKey: string;
      customerKey: string;
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

  return `${price.toLocaleString('ko-KR')}원`;
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

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [billingData, setBillingData] = useState<PlanBillingResponse | null>(null);
  const [billingDialogType, setBillingDialogType] = useState<BillingDialogType>(null);

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

  async function handleBillingAuth(purpose: 'plan_subscription' | 'billing_method') {
    try {
      setIsProcessing(true);
      setErrorMessage('');
      setSuccessMessage('');

      if (!billingData?.site?.id) {
        throw new Error('사이트 정보가 없습니다.');
      }

      const response = await fetch('/api/payments/toss/plan-billing/start', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteId: billingData.site.id,
          orderName: purpose === 'billing_method' ? '데브허브 결제수단 추가' : '데브허브 사이트 요금제 결제수단 등록',
          successUrl: `/${siteName}/manage/payments/billing/success`,
          failUrl: `/${siteName}/manage/payments/billing/fail`,
          purpose,
        }),
      });

      const result = (await response.json()) as PlanBillingStartResponse;

      if (!response.ok) {
        throw new Error('error' in result ? result.error : '결제수단 등록을 시작하지 못했습니다.');
      }

      if ('error' in result) {
        throw new Error(result.error || '결제수단 등록을 시작하지 못했습니다.');
      }

      if (result.mode === 'direct_billing') {
        const isLoaded = await loadData();

        if (isLoaded) {
          setSuccessMessage(
            purpose === 'billing_method' ? '결제수단이 추가되었습니다.' : '결제수단 등록이 완료되었습니다.',
          );
        }

        setIsProcessing(false);
        return;
      }

      if (!result.clientKey || !result.customerKey || !result.successUrl || !result.failUrl) {
        throw new Error('결제수단 등록 정보가 올바르지 않습니다.');
      }

      const tossPayments = await loadTossPayments(result.clientKey);

      await tossPayments.requestBillingAuth('카드', {
        customerKey: result.customerKey,
        successUrl: result.successUrl,
        failUrl: result.failUrl,
      });
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '결제수단 등록을 시작하지 못했습니다.');
      } else {
        setErrorMessage('결제수단 등록을 시작하지 못했습니다.');
      }

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

      const response = await fetch('/api/payments/toss/plan-billing/cancel', {
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

      const response = await fetch('/api/payments/toss/plan-billing/resume', {
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

  if (isLoading) {
    return (
      <Container menu="payments">
        <LoadingIndicator />
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
    <Container menu="payments">
      <Snackbar
        open={Boolean(errorMessage)}
        autoHideDuration={4000}
        message={errorMessage}
        onClose={() => setErrorMessage('')}
      />
      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={4000}
        message={successMessage}
        onClose={() => setSuccessMessage('')}
      />

      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6" component="h2">
              사이트 요금제
            </Typography>
            <Typography>요금제: {billingData?.plan?.name ?? '-'}</Typography>
            <Typography>월 이용료: {formatPrice(billingData?.plan?.price)}</Typography>

            {subscription ? (
              <Stack spacing={1}>
                <Typography>상태: {getSubscriptionStatusText(subscription.status)}</Typography>
                {isScheduledCancel ? (
                  <Typography color="warning.main">취소 예약됨: 다음 결제부터 중단됩니다.</Typography>
                ) : null}
                <Typography>
                  현재 이용 기간: {formatDateTime(subscription.current_period_start)} ~{' '}
                  {formatDateTime(subscription.current_period_end)}
                </Typography>
                <Typography>다음 결제 예정일: {formatDateTime(subscription.next_billing_at)}</Typography>
                {subscription.status === 'past_due' ? (
                  <Typography color="error" role="alert">
                    자동결제에 실패했습니다. 결제수단을 확인하거나 결제를 다시 시도해 주세요.
                  </Typography>
                ) : null}
              </Stack>
            ) : (
              <Typography color="text.secondary">
                아직 결제수단이 등록되지 않았습니다. 결제수단을 등록하면 사이트가 오픈되고 무료체험이 적용됩니다.
              </Typography>
            )}

            <Stack direction="row" spacing={1} flexWrap="wrap">
              {shouldShowBillingAuthButton ? (
                <Button
                  type="button"
                  variant="contained"
                  onClick={() => {
                    void handleBillingAuth('plan_subscription');
                  }}
                  disabled={isProcessing}
                >
                  {subscription ? '다시 구독하기' : '결제수단 등록하기'}
                </Button>
              ) : null}

              {canRetryPayment ? (
                <Button
                  type="button"
                  variant="contained"
                  onClick={() => setBillingDialogType('retry')}
                  disabled={isProcessing}
                >
                  결제 다시 시도
                </Button>
              ) : null}

              {canRefundSubscription ? (
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => setBillingDialogType('refund')}
                  disabled={isProcessing}
                >
                  환불받기
                </Button>
              ) : null}

              {canCancelSubscription ? (
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => setBillingDialogType('cancel')}
                  disabled={isProcessing}
                >
                  취소하기
                </Button>
              ) : null}

              {canResumeSubscription ? (
                <Button
                  type="button"
                  variant="contained"
                  onClick={() => {
                    void handleResumePlanBilling();
                  }}
                  disabled={isProcessing}
                >
                  취소 철회하기
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6" component="h2">
              결제 수단
            </Typography>
            <Typography color="text.secondary">자동결제에 사용할 카드를 관리합니다.</Typography>

            {billingMethods.length ? (
              <Stack spacing={1}>
                {billingMethods.map((billingMethod) => (
                  <Paper key={billingMethod.id} variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={0.5}>
                      <Typography>{billingMethod.card_company ?? '카드'}</Typography>
                      <Typography>{formatCardNumber(billingMethod.card_number_masked)}</Typography>
                      <Typography color="text.secondary">{billingMethod.is_default ? '사용 중' : '등록됨'}</Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography color="text.secondary">등록된 결제 수단이 없습니다.</Typography>
            )}

            {canAddBillingMethod ? (
              <Button
                type="button"
                variant="outlined"
                onClick={() => {
                  void handleBillingAuth('billing_method');
                }}
                disabled={isProcessing}
              >
                결제 수단 추가하기
              </Button>
            ) : null}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6" component="h2">
              결제 내역
            </Typography>

            {payments.length ? (
              <Stack spacing={2} divider={<Divider />}>
                {payments.map((payment) => (
                  <Stack key={payment.id} spacing={0.5}>
                    <Typography>상태: {getPaymentStatusText(payment.status, payment.failure_stage)}</Typography>
                    <Typography>금액: {formatPrice(payment.amount)}</Typography>
                    <Typography>주문번호: {payment.order_no}</Typography>
                    <Typography>결제일: {formatDateTime(payment.approved_at ?? payment.created_at)}</Typography>
                    {payment.status === 'paid' && payment.refundable_until ? (
                      <Typography>환불 가능 기한: {formatDateTime(payment.refundable_until)}</Typography>
                    ) : null}
                    {payment.refunded_at ? (
                      <Typography>환불일: {formatDateTime(payment.refunded_at)}</Typography>
                    ) : null}
                    {payment.failure_message ? (
                      <Typography color="error">실패 사유: {payment.failure_message}</Typography>
                    ) : null}
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Typography color="text.secondary">아직 결제 내역이 없습니다.</Typography>
            )}
          </Stack>
        </Paper>
      </Stack>

      <Dialog open={Boolean(billingDialogType)} onClose={handleCloseBillingDialog}>
        <DialogTitle>{getBillingDialogTitle(billingDialogType)}</DialogTitle>
        <DialogContent>
          <Typography>{getBillingDialogMessage(billingDialogType)}</Typography>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={handleCloseBillingDialog} disabled={isProcessing}>
            닫기
          </Button>
          <Button
            type="button"
            variant="contained"
            onClick={() => {
              void handleConfirmBillingDialog();
            }}
            disabled={isProcessing}
          >
            {getBillingDialogConfirmText(billingDialogType)}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
