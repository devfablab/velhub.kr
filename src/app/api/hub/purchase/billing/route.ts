import { PAYMENT_TARGET_TYPE, PAYMENT_TYPE, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type StigmaRow = {
  id: string;
  user_id: string;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  plan_type: string | null;
  is_shutdown: boolean | null;
};

type PlanRow = {
  id: string;
  plan_label: string;
};

type PaymentRow = {
  id: string;
  target_id: string | null;
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

export async function GET() {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id, user_id')
      .eq('user_id', session.authUserId)
      .maybeSingle();

    if (stigmaResult.error) {
      console.error(stigmaResult.error);

      return Response.json({ error: '사용자 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!stigmaResult.data) {
      return Response.json({
        summary: {
          totalAmount: 0,
          totalRefundedAmount: 0,
          netAmount: 0,
          count: 0,
        },
        payments: [],
      });
    }

    const stigma = stigmaResult.data as StigmaRow;

    const sitesResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label, plan_type, is_shutdown')
      .eq('owner_id', stigma.id)
      .order('created_at', { ascending: false });

    if (sitesResult.error) {
      console.error(sitesResult.error);

      return Response.json({ error: '오너 사이트 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const sites = (sitesResult.data ?? []) as SiteRow[];
    const siteIds = sites.map((site) => site.id);

    if (!siteIds.length) {
      return Response.json({
        summary: {
          totalAmount: 0,
          totalRefundedAmount: 0,
          netAmount: 0,
          count: 0,
        },
        payments: [],
      });
    }

    const planIds = Array.from(new Set(sites.map((site) => normalizeText(site.plan_type)).filter(Boolean)));

    const [plansResult, paymentsResult, subscriptionsResult] = await Promise.all([
      planIds.length
        ? supabaseAdmin.from('plans').select('id, plan_label').in('id', planIds)
        : { data: [], error: null },
      supabaseAdmin
        .from('payments')
        .select(
          'id, target_id, order_no, amount, refunded_amount, currency, status, payment_method, approved_at, created_at, refundable_until, failure_message',
        )
        .eq('buyer_user_id', session.authUserId)
        .eq('payment_type', PAYMENT_TYPE.PLAN_BILLING)
        .eq('target_type', PAYMENT_TARGET_TYPE.PLAN)
        .in('target_id', siteIds)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('subscriptions')
        .select(
          'id, target_id, status, price, current_period_start, current_period_end, next_billing_at, canceled_at, expired_at, created_at',
        )
        .eq('subscriber_user_id', session.authUserId)
        .eq('subscription_type', SUBSCRIPTION_TYPE.PLAN_BILLING)
        .eq('target_type', PAYMENT_TARGET_TYPE.PLAN)
        .in('target_id', siteIds)
        .order('created_at', { ascending: false }),
    ]);

    if (plansResult.error) {
      console.error(plansResult.error);

      return Response.json({ error: '요금제 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (paymentsResult.error) {
      console.error(paymentsResult.error);

      return Response.json({ error: '요금제 결제내역을 불러오지 못했습니다.' }, { status: 500 });
    }

    if (subscriptionsResult.error) {
      console.error(subscriptionsResult.error);

      return Response.json({ error: '요금제 구독 상태를 불러오지 못했습니다.' }, { status: 500 });
    }

    const plans = (plansResult.data ?? []) as PlanRow[];
    const payments = (paymentsResult.data ?? []) as PaymentRow[];
    const subscriptions = (subscriptionsResult.data ?? []) as SubscriptionRow[];

    const siteById = new Map(sites.map((site) => [site.id, site]));
    const planById = new Map(plans.map((plan) => [plan.id, plan]));
    const latestSubscriptionBySiteId = new Map<string, SubscriptionRow>();

    for (const subscription of subscriptions) {
      if (!latestSubscriptionBySiteId.has(subscription.target_id)) {
        latestSubscriptionBySiteId.set(subscription.target_id, subscription);
      }
    }

    return Response.json({
      summary: getSummary(payments),
      payments: payments.map((payment) => {
        const site = payment.target_id ? siteById.get(payment.target_id) : null;
        const plan = site?.plan_type ? planById.get(site.plan_type) : null;
        const subscription = payment.target_id ? latestSubscriptionBySiteId.get(payment.target_id) : null;

        return {
          id: payment.id,
          siteId: site?.id ?? null,
          siteName: site?.site_key ?? null,
          siteLabel: site?.site_label ?? null,
          planLabel: plan?.plan_label ?? null,
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
      return Response.json(
        { error: unknownError.message || '요금제 구입내역을 불러오지 못했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '요금제 구입내역을 불러오지 못했습니다.' }, { status: 500 });
  }
}
