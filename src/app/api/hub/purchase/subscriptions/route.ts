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
  payment_type: string;
  target_type: string;
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

type SubscriptionRow = {
  id: string;
  subscription_type: string;
  target_type: string;
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

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  site_type: string;
};

type BoardRow = {
  id: string;
  site_id: string;
  board_key: string;
  board_label: string | null;
};

type SeriesRow = {
  id: string;
  site_id: string;
  board_id: string;
  series_key: string;
  series_label: string | null;
};

type SubscriptionDisplayInfo = {
  site: SiteRow | null;
  targetLabel: string;
  paymentTypeLabel: string;
};

const SUCCESS_PAYMENT_STATUSES: string[] = [
  PAYMENT_STATUS.PAID,
  PAYMENT_STATUS.PARTIALLY_REFUNDED,
  PAYMENT_STATUS.REFUNDED,
];

const SUBSCRIPTION_PAYMENT_TYPES = [PAYMENT_TYPE.SUBSCRIPTION_BOARD, PAYMENT_TYPE.SUBSCRIPTION_SERIES];

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

function getSubscriptionPaymentTypeLabel(paymentType: string) {
  switch (paymentType) {
    case PAYMENT_TYPE.SUBSCRIPTION_BOARD:
      return '게시판 구독';
    case PAYMENT_TYPE.SUBSCRIPTION_SERIES:
      return '연재 구독';
    default:
      return '구독';
  }
}

function getSubscriptionTypeByPaymentType(paymentType: string) {
  switch (paymentType) {
    case PAYMENT_TYPE.SUBSCRIPTION_BOARD:
      return SUBSCRIPTION_TYPE.SUBSCRIPTION_BOARD;
    case PAYMENT_TYPE.SUBSCRIPTION_SERIES:
      return SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES;
    default:
      return '';
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

function createSubscriptionDisplayInfo({
  payment,
  siteById,
  boardById,
  seriesById,
}: {
  payment: PaymentRow;
  siteById: Map<string, SiteRow>;
  boardById: Map<string, BoardRow>;
  seriesById: Map<string, SeriesRow>;
}): SubscriptionDisplayInfo {
  const paymentTypeLabel = getSubscriptionPaymentTypeLabel(payment.payment_type);

  if (payment.target_type === PAYMENT_TARGET_TYPE.BOARD && payment.target_id) {
    const board = boardById.get(payment.target_id);

    return {
      site: board ? (siteById.get(board.site_id) ?? null) : null,
      targetLabel: board?.board_label || board?.board_key || '게시판 확인 필요',
      paymentTypeLabel,
    };
  }

  if (payment.target_type === PAYMENT_TARGET_TYPE.SERIES && payment.target_id) {
    const series = seriesById.get(payment.target_id);

    return {
      site: series ? (siteById.get(series.site_id) ?? null) : null,
      targetLabel: series?.series_label || series?.series_key || '연재 확인 필요',
      paymentTypeLabel,
    };
  }

  return {
    site: null,
    targetLabel: '구독 대상 확인 필요',
    paymentTypeLabel,
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
          'payment_type',
          'target_type',
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
      .in('payment_type', SUBSCRIPTION_PAYMENT_TYPES)
      .order('created_at', { ascending: false });

    if (paymentsResult.error) {
      console.error(paymentsResult.error);

      return Response.json({ error: '구독 구입내역을 불러오지 못했습니다.' }, { status: 500 });
    }

    const payments = (paymentsResult.data ?? []) as unknown as PaymentRow[];

    const boardTargetIds = payments
      .filter((payment) => payment.target_type === PAYMENT_TARGET_TYPE.BOARD)
      .map((payment) => payment.target_id)
      .filter((targetId): targetId is string => Boolean(targetId));

    const seriesTargetIds = payments
      .filter((payment) => payment.target_type === PAYMENT_TARGET_TYPE.SERIES)
      .map((payment) => payment.target_id)
      .filter((targetId): targetId is string => Boolean(targetId));

    const subscriptionIds = Array.from(
      new Set(
        payments
          .map((payment) => payment.subscription_id)
          .filter((subscriptionId): subscriptionId is string => Boolean(subscriptionId)),
      ),
    );

    const [boardsResult, seriesResult, subscriptionsByIdResult] = await Promise.all([
      boardTargetIds.length
        ? supabaseAdmin.from('boards').select('id, site_id, board_key, board_label').in('id', boardTargetIds)
        : { data: [], error: null },
      seriesTargetIds.length
        ? supabaseAdmin
            .from('board_series')
            .select('id, site_id, board_id, series_key, series_label')
            .in('id', seriesTargetIds)
        : { data: [], error: null },
      subscriptionIds.length
        ? supabaseAdmin
            .from('subscriptions')
            .select(
              [
                'id',
                'subscription_type',
                'target_type',
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
            .in('id', subscriptionIds)
        : { data: [], error: null },
    ]);

    if (boardsResult.error || seriesResult.error || subscriptionsByIdResult.error) {
      console.error(boardsResult.error || seriesResult.error || subscriptionsByIdResult.error);

      return Response.json({ error: '구독 대상 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const boards = (boardsResult.data ?? []) as BoardRow[];
    const seriesList = (seriesResult.data ?? []) as SeriesRow[];
    const subscriptionsById = (subscriptionsByIdResult.data ?? []) as SubscriptionRow[];

    const boardById = new Map(boards.map((board) => [board.id, board]));
    const seriesById = new Map(seriesList.map((series) => [series.id, series]));
    const subscriptionById = new Map(subscriptionsById.map((subscription) => [subscription.id, subscription]));

    const subscriptionTargetPairs = payments
      .map((payment) => ({
        targetType: payment.target_type,
        targetId: payment.target_id,
        subscriptionType: getSubscriptionTypeByPaymentType(payment.payment_type),
      }))
      .filter(
        (
          pair,
        ): pair is {
          targetType: string;
          targetId: string;
          subscriptionType: string;
        } => Boolean(pair.targetId && pair.subscriptionType),
      );

    const subscriptionTargetIds = Array.from(new Set(subscriptionTargetPairs.map((pair) => pair.targetId)));

    const subscriptionsByTargetResult = subscriptionTargetIds.length
      ? await supabaseAdmin
          .from('subscriptions')
          .select(
            [
              'id',
              'subscription_type',
              'target_type',
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
          .in('target_id', subscriptionTargetIds)
          .in('subscription_type', [SUBSCRIPTION_TYPE.SUBSCRIPTION_BOARD, SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES])
          .order('created_at', { ascending: false })
      : { data: [], error: null };

    if (subscriptionsByTargetResult.error) {
      console.error(subscriptionsByTargetResult.error);

      return Response.json({ error: '구독 상태를 불러오지 못했습니다.' }, { status: 500 });
    }

    const subscriptionsByTarget = (subscriptionsByTargetResult.data ?? []) as SubscriptionRow[];
    const latestSubscriptionByTargetKey = new Map<string, SubscriptionRow>();

    subscriptionsByTarget.forEach((subscription) => {
      const targetKey = `${subscription.subscription_type}:${subscription.target_type}:${subscription.target_id}`;

      if (!latestSubscriptionByTargetKey.has(targetKey)) {
        latestSubscriptionByTargetKey.set(targetKey, subscription);
      }
    });

    const siteIds = Array.from(
      new Set([...boards.map((board) => board.site_id), ...seriesList.map((series) => series.site_id)]),
    ).filter(Boolean);

    const sitesResult = siteIds.length
      ? await supabaseAdmin.from('rhizomes').select('id, site_key, site_label, site_type').in('id', siteIds)
      : { data: [], error: null };

    if (sitesResult.error) {
      console.error(sitesResult.error);

      return Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const sites = (sitesResult.data ?? []) as SiteRow[];
    const siteById = new Map(sites.map((site) => [site.id, site]));

    return Response.json({
      summary: getSummary(payments),
      payments: payments.map((payment) => {
        const paymentStatus = normalizePaymentStatus(payment.status);
        const subscriptionType = getSubscriptionTypeByPaymentType(payment.payment_type);
        const targetKey = `${subscriptionType}:${payment.target_type}:${payment.target_id}`;
        const subscription =
          (payment.subscription_id ? subscriptionById.get(payment.subscription_id) : null) ??
          latestSubscriptionByTargetKey.get(targetKey) ??
          null;
        const displayInfo = createSubscriptionDisplayInfo({
          payment,
          siteById,
          boardById,
          seriesById,
        });
        const site = displayInfo.site;
        const isRefunded =
          paymentStatus === PAYMENT_STATUS.REFUNDED || paymentStatus === PAYMENT_STATUS.PARTIALLY_REFUNDED;
        const isCanceled = Boolean(subscription?.canceled_at || subscription?.expired_at);

        return {
          id: payment.id,
          siteId: site?.id ?? null,
          siteName: site?.site_key ?? null,
          siteLabel: site?.site_label ?? null,
          siteType: site?.site_type ?? null,
          paymentType: payment.payment_type,
          targetType: payment.target_type,
          targetId: payment.target_id,
          targetLabel: displayInfo.targetLabel,
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
                subscriptionType: subscription.subscription_type,
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
            targetLabel: displayInfo.targetLabel,
            paymentTypeLabel: displayInfo.paymentTypeLabel,
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
      return Response.json({ error: unknownError.message || '구독 구입내역을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '구독 구입내역을 불러오지 못했습니다.' }, { status: 500 });
  }
}
