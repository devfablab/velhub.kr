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

type TargetRow = {
  id: string;
};

type StigmaRow = {
  user_id: string;
};

type SubscriptionRow = {
  id: string;
  subscription_type: string;
  target_type: string;
  target_id: string;
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

type CancellationMode = 'scheduled' | 'refunded' | 'already_canceled';

export type MemberSiteSubscriptionCancellationResult = {
  subscriptionId: string;
  mode: CancellationMode;
  refundAmount: number;
};

function isBoardSubscription(subscription: SubscriptionRow) {
  return (
    subscription.subscription_type === SUBSCRIPTION_TYPE.SUBSCRIPTION_BOARD &&
    subscription.target_type === PAYMENT_TARGET_TYPE.BOARD
  );
}

function isSeriesSubscription(subscription: SubscriptionRow) {
  return (
    subscription.subscription_type === SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES &&
    subscription.target_type === PAYMENT_TARGET_TYPE.SERIES
  );
}

function getPaymentType(subscription: SubscriptionRow) {
  if (isBoardSubscription(subscription)) {
    return PAYMENT_TYPE.SUBSCRIPTION_BOARD;
  }

  return PAYMENT_TYPE.SUBSCRIPTION_SERIES;
}

function getSubscriptionLabel(subscription: SubscriptionRow) {
  return isBoardSubscription(subscription) ? '게시판' : '연재';
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
      throw new Error('구독 결제 정보를 확인하지 못했습니다.');
    }

    return (paymentResult.data as PaymentRow | null) ?? null;
  }

  const paymentResult = await supabaseAdmin
    .from('payments')
    .select('id, payment_key, amount, refunded_amount, status, approved_at, created_at')
    .eq('buyer_user_id', authUserId)
    .eq('payment_type', getPaymentType(subscription))
    .eq('target_type', subscription.target_type)
    .eq('target_id', subscription.target_id)
    .in('status', [PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_REFUNDED])
    .order('created_at', { ascending: false })
    .limit(1);

  if (paymentResult.error) {
    throw new Error('구독 결제 정보를 확인하지 못했습니다.');
  }

  return ((paymentResult.data ?? [])[0] as PaymentRow | undefined) ?? null;
}

async function scheduleCancellation({
  supabaseAdmin,
  subscriptionId,
  canceledAt,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscriptionId: string;
  canceledAt: string;
}) {
  const subscriptionUpdateResult = await supabaseAdmin
    .from('subscriptions')
    .update({
      next_billing_at: null,
      canceled_at: canceledAt,
      updated_at: canceledAt,
    })
    .eq('id', subscriptionId);

  if (subscriptionUpdateResult.error) {
    throw new Error('구독 취소를 예약하지 못했습니다.');
  }
}

async function finishRefundedSubscription({
  supabaseAdmin,
  subscriptionId,
  canceledAt,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscriptionId: string;
  canceledAt: string;
}) {
  const subscriptionUpdateResult = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: SUBSCRIPTION_STATUS.CANCELED,
      next_billing_at: null,
      canceled_at: canceledAt,
      expired_at: canceledAt,
      updated_at: canceledAt,
    })
    .eq('id', subscriptionId);

  if (subscriptionUpdateResult.error) {
    throw new Error('환불된 구독 정보를 갱신하지 못했습니다.');
  }
}

async function cancelSubscription({
  supabaseAdmin,
  subscription,
  authUserId,
  actionLabel,
  now,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: SubscriptionRow;
  authUserId: string;
  actionLabel: string;
  now: Date;
}): Promise<MemberSiteSubscriptionCancellationResult> {
  if (subscription.canceled_at && subscription.next_billing_at === null) {
    return {
      subscriptionId: subscription.id,
      mode: 'already_canceled',
      refundAmount: 0,
    };
  }

  const nowText = now.toISOString();
  const payment = await getLastPayment({
    supabaseAdmin,
    subscription,
    authUserId,
  });

  if (!payment) {
    await scheduleCancellation({
      supabaseAdmin,
      subscriptionId: subscription.id,
      canceledAt: nowText,
    });

    return {
      subscriptionId: subscription.id,
      mode: 'scheduled',
      refundAmount: 0,
    };
  }

  const refundedAmount = Number(payment.refunded_amount ?? 0);

  if (payment.status === PAYMENT_STATUS.REFUNDED || refundedAmount > 0) {
    await finishRefundedSubscription({
      supabaseAdmin,
      subscriptionId: subscription.id,
      canceledAt: nowText,
    });

    return {
      subscriptionId: subscription.id,
      mode: 'refunded',
      refundAmount: refundedAmount,
    };
  }

  const refundCalculation = calculateSubscriptionRefundAmount({
    amount: payment.amount,
    paidAt: payment.approved_at ?? payment.created_at,
    now,
  });

  if (!refundCalculation.isRefundable) {
    await scheduleCancellation({
      supabaseAdmin,
      subscriptionId: subscription.id,
      canceledAt: nowText,
    });

    return {
      subscriptionId: subscription.id,
      mode: 'scheduled',
      refundAmount: 0,
    };
  }

  if (!payment.payment_key) {
    throw new Error('구독 환불에 필요한 paymentId가 없습니다.');
  }

  const cancelResult = await cancelPortOnePayment({
    paymentId: payment.payment_key,
    cancelReason: `${actionLabel} 처리로 인한 ${getSubscriptionLabel(subscription)} 구독 환불`,
    cancelAmount: refundCalculation.isFullRefund ? undefined : refundCalculation.refundAmount,
  });
  const paymentStatus =
    refundCalculation.refundAmount >= payment.amount ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIALLY_REFUNDED;
  const paymentUpdateResult = await supabaseAdmin
    .from('payments')
    .update({
      status: paymentStatus,
      refunded_amount: refundCalculation.refundAmount,
      refunded_at: nowText,
      raw_data: cancelResult,
    })
    .eq('id', payment.id);

  if (paymentUpdateResult.error) {
    throw new Error('구독 환불 정보를 저장하지 못했습니다.');
  }

  await finishRefundedSubscription({
    supabaseAdmin,
    subscriptionId: subscription.id,
    canceledAt: nowText,
  });

  return {
    subscriptionId: subscription.id,
    mode: 'refunded',
    refundAmount: refundCalculation.refundAmount,
  };
}

export async function cancelMemberSiteSubscriptions({
  supabaseAdmin,
  siteId,
  memberStigmaId,
  actionLabel,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  memberStigmaId: string;
  actionLabel: string;
}) {
  const stigmaResult = await supabaseAdmin.from('stigmas').select('user_id').eq('id', memberStigmaId).maybeSingle();

  if (stigmaResult.error || !stigmaResult.data) {
    throw new Error('멤버의 구독 사용자 정보를 확인하지 못했습니다.');
  }

  const authUserId = (stigmaResult.data as StigmaRow).user_id;
  const subscriptionsResult = await supabaseAdmin
    .from('subscriptions')
    .select(
      [
        'id',
        'subscription_type',
        'target_type',
        'target_id',
        'last_payment_id',
        'next_billing_at',
        'canceled_at',
      ].join(', '),
    )
    .eq('subscriber_user_id', authUserId)
    .in('subscription_type', [SUBSCRIPTION_TYPE.SUBSCRIPTION_BOARD, SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES])
    .in('target_type', [PAYMENT_TARGET_TYPE.BOARD, PAYMENT_TARGET_TYPE.SERIES])
    .in('status', [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PAST_DUE]);

  if (subscriptionsResult.error) {
    throw new Error('멤버의 구독 정보를 확인하지 못했습니다.');
  }

  const subscriptionCandidates = (subscriptionsResult.data ?? []) as unknown as SubscriptionRow[];
  const boardTargetIds = subscriptionCandidates
    .filter(isBoardSubscription)
    .map((subscription) => subscription.target_id);
  const seriesTargetIds = subscriptionCandidates
    .filter(isSeriesSubscription)
    .map((subscription) => subscription.target_id);
  const [boardsResult, seriesResult] = await Promise.all([
    boardTargetIds.length > 0
      ? supabaseAdmin.from('boards').select('id').eq('site_id', siteId).in('id', boardTargetIds)
      : { data: [], error: null },
    seriesTargetIds.length > 0
      ? supabaseAdmin.from('board_series').select('id').eq('site_id', siteId).in('id', seriesTargetIds)
      : { data: [], error: null },
  ]);

  if (boardsResult.error || seriesResult.error) {
    throw new Error('사이트의 구독 대상을 확인하지 못했습니다.');
  }

  const boardIdSet = new Set(((boardsResult.data ?? []) as TargetRow[]).map((board) => board.id));
  const seriesIdSet = new Set(((seriesResult.data ?? []) as TargetRow[]).map((series) => series.id));
  const subscriptions = subscriptionCandidates.filter(
    (subscription) =>
      (isBoardSubscription(subscription) && boardIdSet.has(subscription.target_id)) ||
      (isSeriesSubscription(subscription) && seriesIdSet.has(subscription.target_id)),
  );
  const now = new Date();
  const results: MemberSiteSubscriptionCancellationResult[] = [];

  for (const subscription of subscriptions) {
    results.push(
      await cancelSubscription({
        supabaseAdmin,
        subscription,
        authUserId,
        actionLabel,
        now,
      }),
    );
  }

  return results;
}
