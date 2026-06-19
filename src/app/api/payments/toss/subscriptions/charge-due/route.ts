import { decrypt } from '@/lib/encryption/decrypt';
import { createNextMonthlyBillingPeriod } from '@/lib/payments/billingPeriod';
import { createPaymentOrderNo } from '@/lib/payments/orderNo';
import { getPaymentPolicyMs } from '@/lib/payments/refunds';
import { createOwnerPaymentSplits } from '@/lib/payments/splits';
import { requestTossBillingPayment, TossBillingPaymentError } from '@/lib/payments/toss';
import {
  PAYMENT_METHOD,
  PAYMENT_PROVIDER,
  PAYMENT_STATUS,
  PAYMENT_TARGET_TYPE,
  PAYMENT_TYPE,
  REFUND_POLICY,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TYPE,
} from '@/lib/payments/types';
import { getSupabaseAdmin } from '@/lib/supabase';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type SubscriptionRow = {
  id: string;
  subscriber_user_id: string;
  subscription_type: string;
  target_type: string;
  target_id: string;
  owner_user_id: string | null;
  price: number;
  status: string;
  billing_key: string | null;
  customer_key: string | null;
  current_period_end: string | null;
  next_billing_at: string | null;
  billing_anchor_day: number | null;
};

type BoardRow = {
  id: string;
  site_id: string;
};

type SeriesRow = {
  id: string;
  site_id: string;
  board_id: string;
};

type PaymentTargetInfo = {
  siteId: string;
  boardId: string;
  seriesId: string | null;
};

type TossBillingPaymentResult = {
  paymentKey: string;
  orderId: string;
  orderName: string;
  method: string;
  totalAmount: number;
  status: string;
  approvedAt: string;
  currency?: string;
};

type ChargeDueResult = {
  subscriptionId: string;
  status: 'paid' | 'past_due' | 'skipped';
  paymentId?: string;
  message?: string;
};

function isTestMode() {
  return process.env.NEXT_PUBLIC_APP_ENV === 'test';
}

function verifyTaskRequest(request: Request) {
  if (isTestMode()) {
    return true;
  }

  const taskSecret = process.env.CRON_SECRET ?? process.env.PAYMENT_TASK_SECRET;

  if (!taskSecret) {
    return false;
  }

  const authorization = request.headers.get('authorization');

  return authorization === `Bearer ${taskSecret}`;
}

function createRefundableUntil(startedAt: Date) {
  return new Date(startedAt.getTime() + getPaymentPolicyMs()).toISOString();
}

function createOrderNo(subscriptionType: string) {
  if (subscriptionType === SUBSCRIPTION_TYPE.BOARD_SUBSCRIPTION) {
    return createPaymentOrderNo('BOARD_SUBSCRIPTION');
  }

  return createPaymentOrderNo('SERIES_SUBSCRIPTION');
}

function getPaymentType(subscriptionType: string) {
  if (subscriptionType === SUBSCRIPTION_TYPE.BOARD_SUBSCRIPTION) {
    return PAYMENT_TYPE.BOARD_SUBSCRIPTION;
  }

  if (subscriptionType === SUBSCRIPTION_TYPE.SERIES_SUBSCRIPTION) {
    return PAYMENT_TYPE.SERIES_SUBSCRIPTION;
  }

  return null;
}

function getOrderName(subscriptionType: string) {
  if (subscriptionType === SUBSCRIPTION_TYPE.BOARD_SUBSCRIPTION) {
    return '데브허브 게시판 구독';
  }

  if (subscriptionType === SUBSCRIPTION_TYPE.SERIES_SUBSCRIPTION) {
    return '데브허브 연재 구독';
  }

  return '데브허브 구독';
}

function isBillableSubscription(subscription: SubscriptionRow) {
  if (
    subscription.subscription_type !== SUBSCRIPTION_TYPE.BOARD_SUBSCRIPTION &&
    subscription.subscription_type !== SUBSCRIPTION_TYPE.SERIES_SUBSCRIPTION
  ) {
    return false;
  }

  return (
    subscription.target_type === PAYMENT_TARGET_TYPE.BOARD || subscription.target_type === PAYMENT_TARGET_TYPE.SERIES
  );
}

async function getPaymentTargetInfo({
  supabaseAdmin,
  subscription,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: SubscriptionRow;
}): Promise<PaymentTargetInfo> {
  if (subscription.target_type === PAYMENT_TARGET_TYPE.BOARD) {
    const boardResult = await supabaseAdmin
      .from('boards')
      .select('id, site_id')
      .eq('id', subscription.target_id)
      .maybeSingle();

    if (boardResult.error) {
      throw new Error('게시판 정보를 확인하지 못했습니다.');
    }

    if (!boardResult.data) {
      throw new Error('게시판 정보를 찾을 수 없습니다.');
    }

    const board = boardResult.data as BoardRow;

    return {
      siteId: board.site_id,
      boardId: board.id,
      seriesId: null,
    };
  }

  if (subscription.target_type === PAYMENT_TARGET_TYPE.SERIES) {
    const seriesResult = await supabaseAdmin
      .from('board_series')
      .select('id, site_id, board_id')
      .eq('id', subscription.target_id)
      .maybeSingle();

    if (seriesResult.error) {
      throw new Error('연재 정보를 확인하지 못했습니다.');
    }

    if (!seriesResult.data) {
      throw new Error('연재 정보를 찾을 수 없습니다.');
    }

    const series = seriesResult.data as SeriesRow;

    return {
      siteId: series.site_id,
      boardId: series.board_id,
      seriesId: series.id,
    };
  }

  throw new Error('구독 대상이 올바르지 않습니다.');
}

async function markPastDue({
  supabaseAdmin,
  subscription,
  orderNo,
  paymentType,
  failureCode,
  failureMessage,
  rawData,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: SubscriptionRow;
  orderNo: string;
  paymentType: string;
  failureCode: string | null;
  failureMessage: string;
  rawData: unknown;
}) {
  const nowText = new Date().toISOString();

  const failedPaymentResult = await supabaseAdmin.from('payments').insert({
    provider: PAYMENT_PROVIDER.TOSS,
    payment_key: null,
    order_no: orderNo,
    buyer_user_id: subscription.subscriber_user_id,
    amount: subscription.price,
    refunded_amount: 0,
    currency: 'KRW',
    status: PAYMENT_STATUS.FAILED,
    payment_method: PAYMENT_METHOD.CARD,
    payment_type: paymentType,
    target_type: subscription.target_type,
    target_id: subscription.target_id,
    post_payment: null,
    subscription_id: subscription.id,
    failure_code: failureCode,
    failure_message: failureMessage,
    failure_stage: 'subscriptions_charge_due',
    refund_policy: REFUND_POLICY.SEVEN_DAYS,
    refundable_until: null,
    approved_at: null,
    refunded_at: null,
    raw_data: rawData,
  });

  if (failedPaymentResult.error) {
    console.error(failedPaymentResult.error);
  }

  const subscriptionUpdateResult = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: SUBSCRIPTION_STATUS.PAST_DUE,
      past_due_started_at: nowText,
      updated_at: nowText,
    })
    .eq('id', subscription.id);

  if (subscriptionUpdateResult.error) {
    console.error(subscriptionUpdateResult.error);
  }
}

async function chargeSubscription({
  supabaseAdmin,
  subscription,
  now,
  nowText,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: SubscriptionRow;
  now: Date;
  nowText: string;
}): Promise<ChargeDueResult> {
  const paymentType = getPaymentType(subscription.subscription_type);

  if (!paymentType || !isBillableSubscription(subscription)) {
    return {
      subscriptionId: subscription.id,
      status: 'skipped',
      message: '결제 대상 구독 타입이 아닙니다.',
    };
  }

  if (!subscription.billing_key || !subscription.customer_key) {
    return {
      subscriptionId: subscription.id,
      status: 'skipped',
      message: '빌링키 또는 customerKey가 없습니다.',
    };
  }

  if (!subscription.next_billing_at || !subscription.billing_anchor_day) {
    return {
      subscriptionId: subscription.id,
      status: 'skipped',
      message: '다음 결제일 또는 결제 기준일이 없습니다.',
    };
  }

  if (!subscription.owner_user_id) {
    return {
      subscriptionId: subscription.id,
      status: 'skipped',
      message: '정산 대상 오너 정보가 없습니다.',
    };
  }

  const orderNo = createOrderNo(subscription.subscription_type);

  try {
    const targetInfo = await getPaymentTargetInfo({
      supabaseAdmin,
      subscription,
    });

    const decryptedBillingKey = decrypt(subscription.billing_key);

    const tossPaymentResult = (await requestTossBillingPayment({
      billingKey: decryptedBillingKey,
      customerKey: subscription.customer_key,
      amount: subscription.price,
      orderId: orderNo,
      orderName: getOrderName(subscription.subscription_type),
    })) as TossBillingPaymentResult;

    const paymentInsertResult = await supabaseAdmin
      .from('payments')
      .insert({
        provider: PAYMENT_PROVIDER.TOSS,
        payment_key: tossPaymentResult.paymentKey,
        order_no: orderNo,
        buyer_user_id: subscription.subscriber_user_id,
        amount: tossPaymentResult.totalAmount,
        refunded_amount: 0,
        currency: tossPaymentResult.currency || 'KRW',
        status: PAYMENT_STATUS.PAID,
        payment_method: PAYMENT_METHOD.CARD,
        payment_type: paymentType,
        target_type: subscription.target_type,
        target_id: subscription.target_id,
        post_payment: null,
        subscription_id: subscription.id,
        failure_code: null,
        failure_message: null,
        failure_stage: null,
        refund_policy: REFUND_POLICY.SEVEN_DAYS,
        refundable_until: createRefundableUntil(now),
        approved_at: tossPaymentResult.approvedAt,
        refunded_at: null,
        raw_data: tossPaymentResult,
      })
      .select('id')
      .single();

    if (paymentInsertResult.error) {
      console.error(paymentInsertResult.error);

      await markPastDue({
        supabaseAdmin,
        subscription,
        orderNo,
        paymentType,
        failureCode: null,
        failureMessage: '결제는 승인되었으나 결제 정보 저장에 실패했습니다.',
        rawData: tossPaymentResult,
      });

      return {
        subscriptionId: subscription.id,
        status: 'past_due',
        message: '결제는 승인되었으나 결제 정보 저장에 실패했습니다.',
      };
    }

    const nextBillingPeriod = createNextMonthlyBillingPeriod({
      currentPeriodEnd: subscription.next_billing_at,
      billingAnchorDay: subscription.billing_anchor_day,
    });

    const subscriptionUpdateResult = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        last_payment_id: paymentInsertResult.data.id,
        current_period_start: nextBillingPeriod.currentPeriodStart,
        current_period_end: nextBillingPeriod.currentPeriodEnd,
        next_billing_at: nextBillingPeriod.nextBillingAt,
        past_due_started_at: null,
        updated_at: nowText,
      })
      .eq('id', subscription.id);

    if (subscriptionUpdateResult.error) {
      console.error(subscriptionUpdateResult.error);

      return {
        subscriptionId: subscription.id,
        status: 'paid',
        paymentId: paymentInsertResult.data.id,
        message: '결제는 완료되었으나 구독 기간 갱신에 실패했습니다.',
      };
    }

    await createOwnerPaymentSplits({
      supabaseAdmin,
      paymentId: paymentInsertResult.data.id,
      siteId: targetInfo.siteId,
      boardId: targetInfo.boardId,
      seriesId: targetInfo.seriesId,
      siteOwnerUserId: subscription.owner_user_id,
      amount: tossPaymentResult.totalAmount,
    });

    return {
      subscriptionId: subscription.id,
      status: 'paid',
      paymentId: paymentInsertResult.data.id,
    };
  } catch (unknownError) {
    const failureCode = unknownError instanceof TossBillingPaymentError ? unknownError.code : null;
    const failureMessage =
      unknownError instanceof Error ? unknownError.message || '정기결제에 실패했습니다.' : '정기결제에 실패했습니다.';
    const rawData = unknownError instanceof TossBillingPaymentError ? unknownError.rawData : null;

    await markPastDue({
      supabaseAdmin,
      subscription,
      orderNo,
      paymentType,
      failureCode,
      failureMessage,
      rawData,
    });

    return {
      subscriptionId: subscription.id,
      status: 'past_due',
      message: failureMessage,
    };
  }
}

async function chargeDue(request: Request) {
  if (!verifyTaskRequest(request)) {
    return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const now = new Date();
  const nowText = now.toISOString();

  const subscriptionsResult = await supabaseAdmin
    .from('subscriptions')
    .select(
      [
        'id',
        'subscriber_user_id',
        'subscription_type',
        'target_type',
        'target_id',
        'owner_user_id',
        'price',
        'status',
        'billing_key',
        'customer_key',
        'current_period_end',
        'next_billing_at',
        'billing_anchor_day',
      ].join(', '),
    )
    .in('subscription_type', [SUBSCRIPTION_TYPE.BOARD_SUBSCRIPTION, SUBSCRIPTION_TYPE.SERIES_SUBSCRIPTION])
    .in('target_type', [PAYMENT_TARGET_TYPE.BOARD, PAYMENT_TARGET_TYPE.SERIES])
    .in('status', [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING])
    .is('canceled_at', null)
    .is('expired_at', null)
    .lte('next_billing_at', nowText);

  if (subscriptionsResult.error) {
    console.error(subscriptionsResult.error);

    return Response.json({ error: '결제 대상 구독을 확인하지 못했습니다.' }, { status: 500 });
  }

  const subscriptions = (subscriptionsResult.data ?? []) as unknown as SubscriptionRow[];
  const results: ChargeDueResult[] = [];

  for (const subscription of subscriptions) {
    const result = await chargeSubscription({
      supabaseAdmin,
      subscription,
      now,
      nowText,
    });

    results.push(result);
  }

  return Response.json({
    ok: true,
    chargedCount: results.filter((result) => result.status === 'paid').length,
    pastDueCount: results.filter((result) => result.status === 'past_due').length,
    skippedCount: results.filter((result) => result.status === 'skipped').length,
    results,
  });
}

export async function GET(request: Request) {
  return chargeDue(request);
}

export async function POST(request: Request) {
  return chargeDue(request);
}
