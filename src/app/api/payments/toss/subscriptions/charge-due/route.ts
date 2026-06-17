import crypto from 'crypto';
import { decrypt } from '@/lib/encryption/decrypt';
import { createNextMonthlyBillingPeriod } from '@/lib/payments/billingPeriod';
import { requestTossBillingPayment } from '@/lib/payments/toss';
import { PAYMENT_TARGET_TYPE, PAYMENT_TYPE, SUBSCRIPTION_STATUS, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import { getSupabaseAdmin } from '@/lib/supabase';

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

type TossBillingPaymentResult = {
  paymentKey: string;
  orderId: string;
  orderName: string;
  method: string;
  totalAmount: number;
  status: string;
  approvedAt: string;
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
  const expectedAuthorization = `Bearer ${taskSecret}`;

  return authorization === expectedAuthorization;
}

function createOrderNo() {
  const randomText = crypto.randomBytes(8).toString('hex');
  const timestamp = Date.now();

  return `VH-RENEW-${timestamp}-${randomText}`;
}

function getPaymentType(subscriptionType: string) {
  if (subscriptionType === SUBSCRIPTION_TYPE.PLAN_BILLING) {
    return PAYMENT_TYPE.PLAN_BILLING;
  }

  if (subscriptionType === SUBSCRIPTION_TYPE.BLOG_MEMBERSHIP) {
    return PAYMENT_TYPE.BLOG_MEMBERSHIP;
  }

  if (subscriptionType === SUBSCRIPTION_TYPE.BOARD_SUBSCRIPTION) {
    return PAYMENT_TYPE.BOARD_SUBSCRIPTION;
  }

  if (subscriptionType === SUBSCRIPTION_TYPE.SERIES_SUBSCRIPTION) {
    return PAYMENT_TYPE.SERIES_SUBSCRIPTION;
  }

  return null;
}

function getOrderName(subscriptionType: string) {
  if (subscriptionType === SUBSCRIPTION_TYPE.PLAN_BILLING) {
    return '데브허브 사이트 요금제';
  }

  if (subscriptionType === SUBSCRIPTION_TYPE.BLOG_MEMBERSHIP) {
    return '데브허브 블로그 멤버십';
  }

  if (subscriptionType === SUBSCRIPTION_TYPE.BOARD_SUBSCRIPTION) {
    return '데브허브 게시판 구독';
  }

  if (subscriptionType === SUBSCRIPTION_TYPE.SERIES_SUBSCRIPTION) {
    return '데브허브 연재 구독';
  }

  return '데브허브 구독';
}

function isBillableTargetType(targetType: string) {
  return (
    targetType === PAYMENT_TARGET_TYPE.PLAN ||
    targetType === PAYMENT_TARGET_TYPE.BLOG ||
    targetType === PAYMENT_TARGET_TYPE.BOARD ||
    targetType === PAYMENT_TARGET_TYPE.SERIES
  );
}

async function markPastDue({
  supabaseAdmin,
  subscription,
  orderNo,
  paymentType,
  message,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  subscription: SubscriptionRow;
  orderNo: string;
  paymentType: string;
  message: string;
}) {
  const nowText = new Date().toISOString();

  await supabaseAdmin.from('payments').insert({
    provider: 'toss',
    payment_key: null,
    order_no: orderNo,
    buyer_user_id: subscription.subscriber_user_id,
    amount: subscription.price,
    refunded_amount: 0,
    currency: 'KRW',
    status: 'failed',
    payment_method: null,
    payment_type: paymentType,
    target_type: subscription.target_type,
    target_id: subscription.target_id,
    subscription_id: subscription.id,
    failure_code: null,
    failure_message: message,
    refund_policy: 'seven_days',
    raw_data: {
      message,
    },
  });

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

    const orderNo = createOrderNo();

    try {
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
          provider: 'toss',
          payment_key: tossPaymentResult.paymentKey,
          order_no: orderNo,
          buyer_user_id: subscription.subscriber_user_id,
          amount: subscription.price,
          refunded_amount: 0,
          currency: 'KRW',
          status: 'paid',
          payment_method: tossPaymentResult.method,
          payment_type: paymentType,
          target_type: subscription.target_type,
          target_id: subscription.target_id,
          subscription_id: subscription.id,
          refund_policy: 'seven_days',
          raw_data: tossPaymentResult,
          approved_at: tossPaymentResult.approvedAt,
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
