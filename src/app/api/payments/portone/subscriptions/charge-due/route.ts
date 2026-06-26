import { decrypt } from '@/lib/encryption/decrypt';
import { createNextMonthlyBillingPeriod } from '@/lib/payments/billingPeriod';
import { createPaymentOrderNo } from '@/lib/payments/orderNo';
import { createOwnerPaymentSplits } from '@/lib/payments/splits';
import { getCurrentPortOneProvider, createPortOnePaymentKey, getPortOnePaidAmount, getPortOnePaidAt, getPortOnePaymentFromResponse, getPortOnePaymentMethod, getPortOnePaymentTransactionNo, requestPortOneBillingPayment, assertPortOnePaidPayment } from '@/lib/payments/portone';
import {
  PAYMENT_METHOD,
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
  site_id: string;
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

type PortOneBillingPaymentResult = {
  paymentKey: string;
  orderId: string;
  orderName: string;
  method: string;
  totalAmount: number;
  status: string;
  approvedAt: string;
  currency?: string;
  transactionId?: string | null;
  rawData?: unknown;
};

type ChargeDueResult = {
  subscriptionId: string;
  status: 'paid' | 'past_due' | 'skipped';
  paymentId?: string;
  message?: string;
};


async function requestPortOneBillingPaymentCompat({
  billingKey,
  customerKey,
  amount,
  orderId,
  orderName,
}: {
  billingKey: string;
  customerKey: string;
  amount: number;
  orderId: string;
  orderName: string;
}) {
  const paymentKey = createPortOnePaymentKey(orderId);
  const paymentResponse = await requestPortOneBillingPayment({
    paymentId: paymentKey,
    billingKey,
    customerId: customerKey,
    amount,
    orderName,
  });
  const payment = getPortOnePaymentFromResponse(paymentResponse);

  assertPortOnePaidPayment(payment);

  return {
    paymentKey,
    orderId,
    orderName: payment.orderName ?? orderName,
    method: getPortOnePaymentMethod(payment),
    totalAmount: getPortOnePaidAmount(payment) || amount,
    status: payment.status,
    approvedAt: getPortOnePaidAt(payment),
    currency: payment.amount?.currency ?? 'KRW',
    transactionId: getPortOnePaymentTransactionNo(payment),
    rawData: payment,
  };
}

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
  const expectedAuthorization = `Bearer ${taskSecret}`;

  return authorization === expectedAuthorization;
}

function createOrderNo(subscriptionType: string) {
  if (subscriptionType === SUBSCRIPTION_TYPE.SUBSCRIPTION_BOARD) {
    return createPaymentOrderNo('SUBSCRIPTION_BOARD');
  }

  if (subscriptionType === SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES) {
    return createPaymentOrderNo('SUBSCRIPTION_SERIES');
  }

  if (subscriptionType === SUBSCRIPTION_TYPE.MEMBERSHIP_BLOG) {
    return createPaymentOrderNo('MEMBERSHIP_BLOG');
  }

  return createPaymentOrderNo('PLAN');
}

function getPaymentType(subscriptionType: string) {
  if (subscriptionType === SUBSCRIPTION_TYPE.PLAN_BILLING) {
    return PAYMENT_TYPE.PLAN_BILLING;
  }

  if (subscriptionType === SUBSCRIPTION_TYPE.MEMBERSHIP_BLOG) {
    return PAYMENT_TYPE.MEMBERSHIP_BLOG;
  }

  if (subscriptionType === SUBSCRIPTION_TYPE.SUBSCRIPTION_BOARD) {
    return PAYMENT_TYPE.SUBSCRIPTION_BOARD;
  }

  if (subscriptionType === SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES) {
    return PAYMENT_TYPE.SUBSCRIPTION_SERIES;
  }

  return null;
}

function getOrderName(subscriptionType: string) {
  if (subscriptionType === SUBSCRIPTION_TYPE.PLAN_BILLING) {
    return '데브허브 사이트 요금제';
  }

  if (subscriptionType === SUBSCRIPTION_TYPE.MEMBERSHIP_BLOG) {
    return '데브허브 블로그 멤버십';
  }

  if (subscriptionType === SUBSCRIPTION_TYPE.SUBSCRIPTION_BOARD) {
    return '데브허브 게시판 구독';
  }

  if (subscriptionType === SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES) {
    return '데브허브 연재 구독';
  }

  return '데브허브 구독';
}

function isBillableTargetType(targetType: string) {
  return (
    targetType === PAYMENT_TARGET_TYPE.PLAN ||
    targetType === PAYMENT_TARGET_TYPE.SITE ||
    targetType === PAYMENT_TARGET_TYPE.BOARD ||
    targetType === PAYMENT_TARGET_TYPE.SERIES
  );
}

function shouldCreateOwnerSplits(subscriptionType: string) {
  return (
    subscriptionType === SUBSCRIPTION_TYPE.MEMBERSHIP_BLOG ||
    subscriptionType === SUBSCRIPTION_TYPE.SUBSCRIPTION_BOARD ||
    subscriptionType === SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES
  );
}

async function markPastDue({
  supabaseAdmin,
  subscription,
  orderNo,
  paymentType,
  message,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: SubscriptionRow;
  orderNo: string;
  paymentType: string;
  message: string;
}) {
  const nowText = new Date().toISOString();

  const paymentInsertResult = await supabaseAdmin.from('payments').insert({
    provider: getCurrentPortOneProvider(),
    payment_key: null,
    order_no: orderNo,
    buyer_user_id: subscription.subscriber_user_id,
    amount: subscription.price,
    refunded_amount: 0,
    currency: 'KRW',
    status: PAYMENT_STATUS.FAILED,
    payment_method: null,
    payment_type: paymentType,
    target_type: subscription.target_type,
    target_id: subscription.target_id,
    post_payment: null,
    subscription_id: subscription.id,
    failure_code: null,
    failure_message: message,
    failure_stage: 'subscription_charge_due',
    refund_policy: REFUND_POLICY.SEVEN_DAYS,
    refundable_until: null,
    approved_at: null,
    refunded_at: null,
    raw_data: {
      message,
    },
  });

  if (paymentInsertResult.error) {
    console.error(paymentInsertResult.error);
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
        'site_id',
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
    const paymentType = getPaymentType(subscription.subscription_type);

    if (!paymentType || !isBillableTargetType(subscription.target_type)) {
      results.push({
        subscriptionId: subscription.id,
        status: 'skipped',
        message: '결제 대상 구독 타입이 아닙니다.',
      });
      continue;
    }

    if (!subscription.billing_key || !subscription.customer_key) {
      results.push({
        subscriptionId: subscription.id,
        status: 'skipped',
        message: '빌링키 또는 customerKey가 없습니다.',
      });
      continue;
    }

    if (!subscription.next_billing_at || !subscription.billing_anchor_day) {
      results.push({
        subscriptionId: subscription.id,
        status: 'skipped',
        message: '다음 결제일 또는 결제 기준일이 없습니다.',
      });
      continue;
    }

    const orderNo = createOrderNo(subscription.subscription_type);

    try {
      const decryptedBillingKey = decrypt(subscription.billing_key);

      const portOnePaymentResult = (await requestPortOneBillingPaymentCompat({
        billingKey: decryptedBillingKey,
        customerKey: subscription.customer_key,
        amount: subscription.price,
        orderId: orderNo,
        orderName: getOrderName(subscription.subscription_type),
      })) as PortOneBillingPaymentResult;

      const paymentInsertResult = await supabaseAdmin
        .from('payments')
        .insert({
          provider: getCurrentPortOneProvider(),
          payment_key: portOnePaymentResult.paymentKey,
        tx_no: null,
        transaction_no: portOnePaymentResult.transactionId ?? null,
          order_no: orderNo,
          buyer_user_id: subscription.subscriber_user_id,
          amount: subscription.price,
          refunded_amount: 0,
          currency: 'KRW',
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
          refundable_until: null,
          approved_at: portOnePaymentResult.approvedAt,
          refunded_at: null,
          raw_data: portOnePaymentResult.rawData ?? portOnePaymentResult,
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
          message: '결제는 승인되었으나 결제 정보 저장에 실패했습니다.',
        });

        results.push({
          subscriptionId: subscription.id,
          status: 'past_due',
          message: '결제는 승인되었으나 결제 정보 저장에 실패했습니다.',
        });
        continue;
      }

      if (shouldCreateOwnerSplits(subscription.subscription_type) && subscription.owner_user_id) {
        await createOwnerPaymentSplits({
          supabaseAdmin,
          paymentId: paymentInsertResult.data.id,
          siteId: subscription.site_id,
          siteOwnerUserId: subscription.owner_user_id,
          amount: subscription.price,
        });
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

        results.push({
          subscriptionId: subscription.id,
          status: 'paid',
          paymentId: paymentInsertResult.data.id,
          message: '결제는 완료되었으나 구독 기간 갱신에 실패했습니다.',
        });
        continue;
      }

      results.push({
        subscriptionId: subscription.id,
        status: 'paid',
        paymentId: paymentInsertResult.data.id,
      });
    } catch (unknownError) {
      const message =
        unknownError instanceof Error ? unknownError.message || '정기결제에 실패했습니다.' : '정기결제에 실패했습니다.';

      await markPastDue({
        supabaseAdmin,
        subscription,
        orderNo,
        paymentType,
        message,
      });

      results.push({
        subscriptionId: subscription.id,
        status: 'past_due',
        message,
      });
    }
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
