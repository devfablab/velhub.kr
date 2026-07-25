import { cancelPortOnePayment } from '@/lib/payments/portone';
import { calculateSubscriptionRefundAmount } from '@/lib/payments/refunds';
import {
  PAYMENT_STATUS,
  PAYMENT_TARGET_TYPE,
  PAYMENT_TYPE,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TYPE,
} from '@/lib/payments/types';
import { getSupabaseAdmin } from '@/lib/supabase';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type SubscriptionRow = {
  id: string;
  subscription_type: string;
  target_type: string;
  target_id: string;
  status: string;
  last_payment_id: string | null;
  next_billing_at: string | null;
  canceled_at: string | null;
};

type PaymentRow = {
  id: string;
  payment_key: string | null;
  amount: number;
  refunded_amount: number | null;
  status: string;
  approved_at: string | null;
  created_at: string;
};

const SUBSCRIPTION_PAYMENT_TYPE = {
  [SUBSCRIPTION_TYPE.PLAN_BILLING]: PAYMENT_TYPE.PLAN_BILLING,
  [SUBSCRIPTION_TYPE.MEMBERSHIP_BLOG]: PAYMENT_TYPE.MEMBERSHIP_BLOG,
  [SUBSCRIPTION_TYPE.SUBSCRIPTION_BOARD]: PAYMENT_TYPE.SUBSCRIPTION_BOARD,
  [SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES]: PAYMENT_TYPE.SUBSCRIPTION_SERIES,
} as const;

const SUBSCRIPTION_LABEL = {
  [SUBSCRIPTION_TYPE.PLAN_BILLING]: '요금제',
  [SUBSCRIPTION_TYPE.MEMBERSHIP_BLOG]: '블로그 멤버십',
  [SUBSCRIPTION_TYPE.SUBSCRIPTION_BOARD]: '게시판 구독',
  [SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES]: '연재 구독',
} as const;

function isSupportedSubscription(subscription: SubscriptionRow) {
  return (
    (subscription.subscription_type === SUBSCRIPTION_TYPE.PLAN_BILLING &&
      subscription.target_type === PAYMENT_TARGET_TYPE.PLAN) ||
    (subscription.subscription_type === SUBSCRIPTION_TYPE.MEMBERSHIP_BLOG &&
      subscription.target_type === PAYMENT_TARGET_TYPE.SITE) ||
    (subscription.subscription_type === SUBSCRIPTION_TYPE.SUBSCRIPTION_BOARD &&
      subscription.target_type === PAYMENT_TARGET_TYPE.BOARD) ||
    (subscription.subscription_type === SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES &&
      subscription.target_type === PAYMENT_TARGET_TYPE.SERIES)
  );
}

async function getLastPayment({
  supabaseAdmin,
  subscription,
  authUserId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: SubscriptionRow;
  authUserId: string;
}) {
  if (subscription.last_payment_id) {
    const paymentResult = await supabaseAdmin
      .from('payments')
      .select('id, payment_key, amount, refunded_amount, status, approved_at, created_at')
      .eq('id', subscription.last_payment_id)
      .maybeSingle();

    if (paymentResult.error) {
      throw new Error('결제 정보를 확인하지 못했습니다.');
    }

    return (paymentResult.data as PaymentRow | null) ?? null;
  }

  const paymentType =
    SUBSCRIPTION_PAYMENT_TYPE[subscription.subscription_type as keyof typeof SUBSCRIPTION_PAYMENT_TYPE];
  const paymentResult = await supabaseAdmin
    .from('payments')
    .select('id, payment_key, amount, refunded_amount, status, approved_at, created_at')
    .eq('buyer_user_id', authUserId)
    .eq('payment_type', paymentType)
    .eq('target_type', subscription.target_type)
    .eq('target_id', subscription.target_id)
    .in('status', [PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_REFUNDED])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentResult.error) {
    throw new Error('결제 정보를 확인하지 못했습니다.');
  }

  return (paymentResult.data as PaymentRow | null) ?? null;
}

async function finishCancellation({
  supabaseAdmin,
  subscription,
  nowIso,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: SubscriptionRow;
  nowIso: string;
}) {
  const subscriptionResult = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: SUBSCRIPTION_STATUS.CANCELED,
      next_billing_at: null,
      canceled_at: nowIso,
      expired_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', subscription.id);

  if (subscriptionResult.error) {
    throw new Error('구독 취소 정보를 저장하지 못했습니다.');
  }

  if (subscription.subscription_type === SUBSCRIPTION_TYPE.PLAN_BILLING) {
    const shutdownResult = await supabaseAdmin
      .from('rhizomes')
      .update({ is_shutdown: true })
      .eq('id', subscription.target_id);

    if (shutdownResult.error) {
      throw new Error('요금제 사이트를 닫지 못했습니다.');
    }
  }
}

async function scheduleCancellation({
  supabaseAdmin,
  subscription,
  nowIso,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: SubscriptionRow;
  nowIso: string;
}) {
  const updateValue =
    subscription.subscription_type === SUBSCRIPTION_TYPE.PLAN_BILLING
      ? {
          status: 'scheduled_cancel',
          next_billing_at: null,
          canceled_at: nowIso,
          expired_at: null,
          updated_at: nowIso,
        }
      : {
          next_billing_at: null,
          canceled_at: nowIso,
          updated_at: nowIso,
        };
  const subscriptionResult = await supabaseAdmin.from('subscriptions').update(updateValue).eq('id', subscription.id);

  if (subscriptionResult.error) {
    throw new Error('다음 결제 취소 정보를 저장하지 못했습니다.');
  }
}

async function cancelSubscription({
  supabaseAdmin,
  subscription,
  authUserId,
  now,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: SubscriptionRow;
  authUserId: string;
  now: Date;
}) {
  if (subscription.canceled_at && subscription.next_billing_at === null) {
    return;
  }

  const nowIso = now.toISOString();
  const payment = await getLastPayment({
    supabaseAdmin,
    subscription,
    authUserId,
  });

  if (!payment || subscription.status === SUBSCRIPTION_STATUS.TRIALING) {
    await finishCancellation({
      supabaseAdmin,
      subscription,
      nowIso,
    });
    return;
  }

  const refundedAmount = Number(payment.refunded_amount ?? 0);

  if (payment.status === PAYMENT_STATUS.REFUNDED || refundedAmount > 0) {
    await finishCancellation({
      supabaseAdmin,
      subscription,
      nowIso,
    });
    return;
  }

  const refundCalculation = calculateSubscriptionRefundAmount({
    amount: payment.amount,
    paidAt: payment.approved_at ?? payment.created_at,
    now,
  });

  if (!refundCalculation.isRefundable) {
    await scheduleCancellation({
      supabaseAdmin,
      subscription,
      nowIso,
    });
    return;
  }

  if (!payment.payment_key) {
    throw new Error('환불에 필요한 결제 정보가 없습니다.');
  }

  const label = SUBSCRIPTION_LABEL[subscription.subscription_type as keyof typeof SUBSCRIPTION_LABEL];
  const cancelResult = await cancelPortOnePayment({
    paymentId: payment.payment_key,
    cancelReason: `데브허브 탈퇴 신청에 따른 ${label} 환불`,
    cancelAmount: refundCalculation.isFullRefund ? undefined : refundCalculation.refundAmount,
  });
  const paymentStatus =
    refundCalculation.refundAmount >= payment.amount ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIALLY_REFUNDED;
  const paymentResult = await supabaseAdmin
    .from('payments')
    .update({
      status: paymentStatus,
      refunded_amount: refundCalculation.refundAmount,
      refunded_at: nowIso,
      raw_data: cancelResult,
    })
    .eq('id', payment.id);

  if (paymentResult.error) {
    throw new Error('환불 정보를 저장하지 못했습니다.');
  }

  await finishCancellation({
    supabaseAdmin,
    subscription,
    nowIso,
  });
}

export async function cancelAccountRecurringPayments({
  supabaseAdmin,
  authUserId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  authUserId: string;
}) {
  const subscriptionsResult = await supabaseAdmin
    .from('subscriptions')
    .select(
      [
        'id',
        'subscription_type',
        'target_type',
        'target_id',
        'status',
        'last_payment_id',
        'next_billing_at',
        'canceled_at',
      ].join(', '),
    )
    .eq('subscriber_user_id', authUserId)
    .in('subscription_type', [
      SUBSCRIPTION_TYPE.PLAN_BILLING,
      SUBSCRIPTION_TYPE.MEMBERSHIP_BLOG,
      SUBSCRIPTION_TYPE.SUBSCRIPTION_BOARD,
      SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES,
    ])
    .in('status', [SUBSCRIPTION_STATUS.TRIALING, SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PAST_DUE]);

  if (subscriptionsResult.error) {
    throw new Error('구독 정보를 확인하지 못했습니다.');
  }

  const subscriptions = ((subscriptionsResult.data ?? []) as unknown as SubscriptionRow[]).filter(
    isSupportedSubscription,
  );
  const now = new Date();

  for (const subscription of subscriptions) {
    await cancelSubscription({
      supabaseAdmin,
      subscription,
      authUserId,
      now,
    });
  }

  return subscriptions.length;
}
