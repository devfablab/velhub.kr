import { PAYMENT_TARGET_TYPE, PAYMENT_TYPE, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';

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

const SUCCESS_PAYMENT_STATUSES = ['paid', 'partially_refunded', 'refunded'];

function getPaymentStatusLabel(status: string) {
  switch (status) {
    case 'paid':
      return '결제 완료';
    case 'failed':
      return '결제 실패';
    case 'refunded':
      return '환불 완료';
    case 'partially_refunded':
      return '부분 환불';
    default:
      return '확인 필요';
  }
}

function getSubscriptionStatusLabel(status: string, canceledAt: string | null, expiredAt: string | null) {
  if (expiredAt) return '중단';
  if (canceledAt) return '해지 예정';

  switch (status) {
    case 'trialing':
      return '무료 이용 중';
    case 'active':
      return '이용 중';
    case 'past_due':
      return '결제 유예 중';
    case 'canceled':
    case 'expired':
      return '중단';
    default:
      return '확인 필요';
  }
}

function getPaymentTypeLabel(paymentType: string) {
  if (paymentType === PAYMENT_TYPE.BOARD_SUBSCRIPTION) return '게시판 구독';
  if (paymentType === PAYMENT_TYPE.SERIES_SUBSCRIPTION) return '연재 구독';

  return '구독';
}

function getSummary(payments: PaymentRow[]) {
  const successPayments = payments.filter((payment) => SUCCESS_PAYMENT_STATUSES.includes(payment.status));
  const totalAmount = successPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalRefundedAmount = successPayments.reduce((sum, payment) => sum + (payment.refunded_amount ?? 0), 0);

  return {
    totalAmount,
    totalRefundedAmount,
    netAmount: totalAmount - totalRefundedAmount,
    count: payments.length,
  };
}

function getSubscriptionKey(targetType: string, targetId: string | null) {
  return `${targetType}:${targetId ?? ''}`;
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
        'id, payment_type, target_type, target_id, subscription_id, order_no, amount, refunded_amount, currency, status, payment_method, approved_at, created_at, refundable_until, failure_message',
      )
      .eq('buyer_user_id', session.authUserId)
      .in('payment_type', [PAYMENT_TYPE.BOARD_SUBSCRIPTION, PAYMENT_TYPE.SERIES_SUBSCRIPTION])
      .in('target_type', [PAYMENT_TARGET_TYPE.BOARD, PAYMENT_TARGET_TYPE.SERIES])
      .order('created_at', { ascending: false });

    if (paymentsResult.error) {
      console.error(paymentsResult.error);

      return Response.json({ error: '구독 구입내역을 불러오지 못했습니다.' }, { status: 500 });
    }

    const payments = (paymentsResult.data ?? []) as PaymentRow[];
    const boardIds = Array.from(
      new Set(
        payments
          .filter((payment) => payment.target_type === PAYMENT_TARGET_TYPE.BOARD)
          .map((payment) => payment.target_id)
          .filter((targetId): targetId is string => Boolean(targetId)),
      ),
    );
    const seriesIds = Array.from(
      new Set(
        payments
          .filter((payment) => payment.target_type === PAYMENT_TARGET_TYPE.SERIES)
          .map((payment) => payment.target_id)
          .filter((targetId): targetId is string => Boolean(targetId)),
      ),
    );

    const [boardsResult, seriesResult, subscriptionsResult] = await Promise.all([
      boardIds.length
        ? supabaseAdmin.from('boards').select('id, site_id, board_key, board_label').in('id', boardIds)
        : { data: [], error: null },
      seriesIds.length
        ? supabaseAdmin
            .from('board_series')
            .select('id, site_id, board_id, series_key, series_label')
            .in('id', seriesIds)
        : { data: [], error: null },
      payments.length
        ? supabaseAdmin
            .from('subscriptions')
            .select(
              'id, subscription_type, target_type, target_id, status, price, current_period_start, current_period_end, next_billing_at, canceled_at, expired_at, created_at',
            )
            .eq('subscriber_user_id', session.authUserId)
            .in('subscription_type', [SUBSCRIPTION_TYPE.BOARD_SUBSCRIPTION, SUBSCRIPTION_TYPE.SERIES_SUBSCRIPTION])
            .in('target_type', [PAYMENT_TARGET_TYPE.BOARD, PAYMENT_TARGET_TYPE.SERIES])
            .order('created_at', { ascending: false })
        : { data: [], error: null },
    ]);

    if (boardsResult.error) {
      console.error(boardsResult.error);

      return Response.json({ error: '게시판 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (seriesResult.error) {
      console.error(seriesResult.error);

      return Response.json({ error: '연재 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (subscriptionsResult.error) {
      console.error(subscriptionsResult.error);

      return Response.json({ error: '구독 상태를 불러오지 못했습니다.' }, { status: 500 });
    }

    const boards = (boardsResult.data ?? []) as BoardRow[];
    const seriesList = (seriesResult.data ?? []) as SeriesRow[];
    const subscriptions = (subscriptionsResult.data ?? []) as SubscriptionRow[];

    const boardById = new Map(boards.map((board) => [board.id, board]));
    const seriesById = new Map(seriesList.map((series) => [series.id, series]));
    const siteIds = Array.from(
      new Set([...boards.map((board) => board.site_id), ...seriesList.map((series) => series.site_id)]),
    );

    const sitesResult = siteIds.length
      ? await supabaseAdmin.from('rhizomes').select('id, site_key, site_label, site_type').in('id', siteIds)
      : { data: [], error: null };

    if (sitesResult.error) {
      console.error(sitesResult.error);

      return Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const sites = (sitesResult.data ?? []) as SiteRow[];
    const siteById = new Map(sites.map((site) => [site.id, site]));
    const latestSubscriptionByKey = new Map<string, SubscriptionRow>();

    for (const subscription of subscriptions) {
      const subscriptionKey = getSubscriptionKey(subscription.target_type, subscription.target_id);

      if (!latestSubscriptionByKey.has(subscriptionKey)) {
        latestSubscriptionByKey.set(subscriptionKey, subscription);
      }
    }

    return Response.json({
      summary: getSummary(payments),
      payments: payments.map((payment) => {
        const board =
          payment.target_type === PAYMENT_TARGET_TYPE.BOARD && payment.target_id
            ? boardById.get(payment.target_id)
            : null;
        const series =
          payment.target_type === PAYMENT_TARGET_TYPE.SERIES && payment.target_id
            ? seriesById.get(payment.target_id)
            : null;
        const site = board ? siteById.get(board.site_id) : series ? siteById.get(series.site_id) : null;
        const subscription = latestSubscriptionByKey.get(getSubscriptionKey(payment.target_type, payment.target_id));

        return {
          id: payment.id,
          paymentType: payment.payment_type,
          paymentTypeLabel: getPaymentTypeLabel(payment.payment_type),
          targetType: payment.target_type,
          targetId: payment.target_id,
          siteId: site?.id ?? null,
          siteName: site?.site_key ?? null,
          siteLabel: site?.site_label ?? null,
          siteType: site?.site_type ?? null,
          boardId: board?.id ?? series?.board_id ?? null,
          boardName: board?.board_key ?? null,
          boardLabel: board?.board_label ?? null,
          seriesId: series?.id ?? null,
          seriesName: series?.series_key ?? null,
          seriesLabel: series?.series_label ?? null,
          orderNo: payment.order_no,
          amount: payment.amount,
          refundedAmount: payment.refunded_amount ?? 0,
          netAmount: payment.amount - (payment.refunded_amount ?? 0),
          currency: payment.currency ?? 'KRW',
          status: payment.status,
          statusLabel: getPaymentStatusLabel(payment.status),
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
