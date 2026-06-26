import {
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PAYMENT_TARGET_TYPE,
  PAYMENT_TYPE,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TYPE,
} from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type PaymentRow = {
  id: string;
  target_id: string | null;
  subscription_id: string | null;
  order_no: string | null;
  amount: number;
  refunded_amount: number | null;
  currency: string | null;
  status: string;
  payment_method: string | null;
  approved_at: string | null;
  created_at: string;
  refundable_until: string | null;
  failure_message: string | null;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  site_type: string;
};

type SubscriptionRow = {
  id: string;
  target_id: string;
  status: string;
  price: number;
  current_period_start: string | null;
  current_period_end: string | null;
  next_billing_at: string | null;
  canceled_at: string | null;
  expired_at: string | null;
  created_at: string;
};

const SUCCESS_PAYMENT_STATUSES: string[] = [
  PAYMENT_STATUS.PAID,
  PAYMENT_STATUS.PARTIALLY_REFUNDED,
  PAYMENT_STATUS.REFUNDED,
];

function normalizePaymentStatus(status: string) {
  return normalizeText(status).toLowerCase();
}

function getPaymentStatusLabel(status: string) {
  switch (normalizePaymentStatus(status)) {
    case PAYMENT_STATUS.PAID:
      return '결제 완료';
    case PAYMENT_STATUS.FAILED:
      return '결제 실패';
    case PAYMENT_STATUS.REFUNDED:
      return '환불 완료';
    case PAYMENT_STATUS.PARTIALLY_REFUNDED:
      return '부분 환불';
    default:
      return '확인 필요';
  }
}

function getPaymentMethodLabel(paymentMethod: string | null) {
  const normalizedPaymentMethod = normalizeText(paymentMethod).toLowerCase();

  if (!normalizedPaymentMethod) {
    return '결제수단 확인 필요';
  }

  if (normalizedPaymentMethod === PAYMENT_METHOD.CARD) {
    return '카드';
  }

  return normalizedPaymentMethod;
}

function getSubscriptionStatusLabel(status: string, canceledAt: string | null, expiredAt: string | null) {
  const normalizedStatus = normalizeText(status).toLowerCase();

  if (expiredAt) {
    return '중단';
  }

  if (canceledAt) {
    return '해지 예정';
  }

  switch (normalizedStatus) {
    case SUBSCRIPTION_STATUS.TRIALING:
      return '무료 이용 중';
    case SUBSCRIPTION_STATUS.ACTIVE:
      return '이용 중';
    case SUBSCRIPTION_STATUS.PAST_DUE:
      return '결제 유예 중';
    case SUBSCRIPTION_STATUS.CANCELED:
    case SUBSCRIPTION_STATUS.EXPIRED:
      return '중단';
    default:
      return '확인 필요';
  }
}

function getSummary(payments: PaymentRow[]) {
  const successPayments = payments.filter((payment) =>
    SUCCESS_PAYMENT_STATUSES.includes(normalizePaymentStatus(payment.status)),
  );

  const totalAmount = successPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalRefundedAmount = successPayments.reduce((sum, payment) => sum + (payment.refunded_amount ?? 0), 0);

  return {
    totalAmount,
    totalRefundedAmount,
    netAmount: totalAmount - totalRefundedAmount,
    count: payments.length,
  };
}

export async function GET() {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const paymentsResult = await supabaseAdmin
      .from('payments')
      .select(
        [
          'id',
          'target_id',
          'subscription_id',
          'order_no',
          'amount',
          'refunded_amount',
          'currency',
          'status',
          'payment_method',
          'approved_at',
          'created_at',
          'refundable_until',
          'failure_message',
        ].join(', '),
      )
      .eq('buyer_user_id', session.authUserId)
      .eq('payment_type', PAYMENT_TYPE.MEMBERSHIP_BLOG)
      .eq('target_type', PAYMENT_TARGET_TYPE.SITE)
      .order('created_at', { ascending: false });

    if (paymentsResult.error) {
      console.error(paymentsResult.error);

      return Response.json({ error: '멤버십 구입내역을 불러오지 못했습니다.' }, { status: 500 });
    }

    const payments = (paymentsResult.data ?? []) as unknown as PaymentRow[];

    const siteIds = Array.from(
      new Set(payments.map((payment) => payment.target_id).filter((targetId): targetId is string => Boolean(targetId))),
    );

    const subscriptionIds = Array.from(
      new Set(
        payments
          .map((payment) => payment.subscription_id)
          .filter((subscriptionId): subscriptionId is string => Boolean(subscriptionId)),
      ),
    );

    const [sitesResult, subscriptionsByIdResult, subscriptionsBySiteResult] = await Promise.all([
      siteIds.length
        ? supabaseAdmin.from('rhizomes').select('id, site_key, site_label, site_type').in('id', siteIds)
        : { data: [], error: null },
      subscriptionIds.length
        ? supabaseAdmin
            .from('subscriptions')
            .select(
              [
                'id',
                'target_id',
                'status',
                'price',
                'current_period_start',
                'current_period_end',
                'next_billing_at',
                'canceled_at',
                'expired_at',
                'created_at',
              ].join(', '),
            )
            .in('id', subscriptionIds)
            .eq('subscriber_user_id', session.authUserId)
            .eq('subscription_type', SUBSCRIPTION_TYPE.MEMBERSHIP_BLOG)
            .eq('target_type', PAYMENT_TARGET_TYPE.SITE)
        : { data: [], error: null },
      siteIds.length
        ? supabaseAdmin
            .from('subscriptions')
            .select(
              [
                'id',
                'target_id',
                'status',
                'price',
                'current_period_start',
                'current_period_end',
                'next_billing_at',
                'canceled_at',
                'expired_at',
                'created_at',
              ].join(', '),
            )
            .eq('subscriber_user_id', session.authUserId)
            .eq('subscription_type', SUBSCRIPTION_TYPE.MEMBERSHIP_BLOG)
            .eq('target_type', PAYMENT_TARGET_TYPE.SITE)
            .in('target_id', siteIds)
            .order('created_at', { ascending: false })
        : { data: [], error: null },
    ]);

    if (sitesResult.error) {
      console.error(sitesResult.error);

      return Response.json({ error: '멤버십 대상 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (subscriptionsByIdResult.error || subscriptionsBySiteResult.error) {
      console.error(subscriptionsByIdResult.error || subscriptionsBySiteResult.error);

      return Response.json({ error: '멤버십 상태를 불러오지 못했습니다.' }, { status: 500 });
    }

    const sites = (sitesResult.data ?? []) as SiteRow[];
    const subscriptionsById = (subscriptionsByIdResult.data ?? []) as SubscriptionRow[];
    const subscriptionsBySite = (subscriptionsBySiteResult.data ?? []) as SubscriptionRow[];

    const siteById = new Map(sites.map((site) => [site.id, site]));
    const subscriptionById = new Map(subscriptionsById.map((subscription) => [subscription.id, subscription]));
    const latestSubscriptionBySiteId = new Map<string, SubscriptionRow>();

    for (const subscription of subscriptionsBySite) {
      if (!latestSubscriptionBySiteId.has(subscription.target_id)) {
        latestSubscriptionBySiteId.set(subscription.target_id, subscription);
      }
    }

    return Response.json({
      summary: getSummary(payments),
      payments: payments.map((payment) => {
        const paymentStatus = normalizePaymentStatus(payment.status);
        const site = payment.target_id ? siteById.get(payment.target_id) : null;
        const subscription =
          (payment.subscription_id ? subscriptionById.get(payment.subscription_id) : null) ??
          (payment.target_id ? latestSubscriptionBySiteId.get(payment.target_id) : null) ??
          null;
        const paymentTypeLabel = '블로그 멤버십';
        const isRefunded =
          paymentStatus === PAYMENT_STATUS.REFUNDED || paymentStatus === PAYMENT_STATUS.PARTIALLY_REFUNDED;
        const isCanceled = Boolean(subscription?.canceled_at || subscription?.expired_at);

        return {
          id: payment.id,
          siteId: site?.id ?? null,
          siteName: site?.site_key ?? null,
          siteLabel: site?.site_label ?? null,
          siteType: site?.site_type ?? null,
          orderNo: payment.order_no,
          amount: payment.amount,
          refundedAmount: payment.refunded_amount ?? 0,
          netAmount: payment.amount - (payment.refunded_amount ?? 0),
          currency: payment.currency ?? 'KRW',
          status: paymentStatus,
          statusLabel: getPaymentStatusLabel(paymentStatus),
          paymentMethod: payment.payment_method,
          approvedAt: payment.approved_at,
          createdAt: payment.created_at,
          refundableUntil: payment.refundable_until,
          failureMessage: payment.failure_message,
          subscription: subscription
            ? {
                id: subscription.id,
                status: subscription.status,
                statusLabel: getSubscriptionStatusLabel(
                  subscription.status,
                  subscription.canceled_at,
                  subscription.expired_at,
                ),
                price: subscription.price,
                currentPeriodStart: subscription.current_period_start,
                currentPeriodEnd: subscription.current_period_end,
                nextBillingAt: subscription.next_billing_at,
                canceledAt: subscription.canceled_at,
                expiredAt: subscription.expired_at,
              }
            : null,
          detail: {
            detailType: 'billing',
            siteLabel: site?.site_label || site?.site_key || '사이트 확인 필요',
            targetLabel: null,
            paymentTypeLabel,
            paymentMethodLabel: getPaymentMethodLabel(payment.payment_method),
            approvedAt: payment.approved_at,
            createdAt: payment.created_at,
            status: paymentStatus,
            statusLabel: getPaymentStatusLabel(paymentStatus),
            amount: payment.amount,
            refundedAmount: payment.refunded_amount ?? 0,
            orderNo: payment.order_no,
            nextBillingAt: !isRefunded && !isCanceled ? (subscription?.next_billing_at ?? null) : null,
            serviceEndsAt:
              !isRefunded && isCanceled ? (subscription?.current_period_end ?? subscription?.expired_at ?? null) : null,
            refundedAt: isRefunded ? (payment.approved_at ?? payment.created_at) : null,
            refundableUntil: null,
            isRefundable: false,
          },
        };
      }),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '멤버십 구입내역을 불러오지 못했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '멤버십 구입내역을 불러오지 못했습니다.' }, { status: 500 });
  }
}
