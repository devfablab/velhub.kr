import { decrypt } from '@/lib/encryption/decrypt';
import { createNextMonthlyBillingPeriod } from '@/lib/payments/billingPeriod';
import { createPaymentOrderNo } from '@/lib/payments/orderNo';
import {
  getCurrentPortOneProvider,
  createPortOnePaymentKey,
  getPortOnePaidAmount,
  getPortOnePaidAt,
  PortOneApiError,
  requestPortOneBillingPayment,
  type PortOnePayment,
  type PortOnePaymentResponse,
  getPortOnePaymentTransactionNo,
} from '@/lib/payments/portone';
import { getPaymentPolicyMs } from '@/lib/payments/refunds';
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
import { normalizeText } from '@/lib/utils';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type PlanBillingSubscriptionRow = {
  id: string;
  subscriber_user_id: string;
  target_id: string;
  price: number;
  billing_key: string;
  customer_key: string;
  next_billing_at: string;
  billing_anchor_day: number;
};

function isValidCronRequest(request: Request) {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'test') {
    return true;
  }

  const authorization = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    throw new Error('자동결제 실행 키가 설정되지 않았습니다.');
  }

  return authorization === `Bearer ${cronSecret}`;
}

function createRefundableUntil(startedAt: Date) {
  return new Date(startedAt.getTime() + getPaymentPolicyMs()).toISOString();
}

function getPaymentFromResponse(paymentResponse: PortOnePaymentResponse) {
  if (paymentResponse.payment) {
    return paymentResponse.payment;
  }

  return paymentResponse as PortOnePayment;
}

function assertPaidPayment(payment: PortOnePayment) {
  if (normalizeText(payment.status).toUpperCase() !== 'PAID') {
    throw new Error('결제가 완료되지 않았습니다.');
  }
}

async function createFailedPayment({
  supabaseAdmin,
  subscription,
  orderNo,
  failureCode,
  failureMessage,
  failureStage,
  rawData,
  nowIso,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: PlanBillingSubscriptionRow;
  orderNo: string;
  failureCode: string | null;
  failureMessage: string;
  failureStage: string;
  rawData: unknown;
  nowIso: string;
}) {
  const failedPaymentResult = await supabaseAdmin.from('payments').insert({
    provider: getCurrentPortOneProvider(),
    payment_key: null,
    order_no: orderNo,
    buyer_user_id: subscription.subscriber_user_id,
    amount: subscription.price,
    refunded_amount: 0,
    currency: 'KRW',
    status: PAYMENT_STATUS.FAILED,
    payment_method: PAYMENT_METHOD.CARD,
    payment_type: PAYMENT_TYPE.PLAN_BILLING,
    target_type: PAYMENT_TARGET_TYPE.PLAN,
    target_id: subscription.target_id,
    post_payment: null,
    subscription_id: subscription.id,
    failure_code: failureCode,
    failure_message: failureMessage,
    failure_stage: failureStage,
    refund_policy: REFUND_POLICY.SEVEN_DAYS,
    refundable_until: null,
    approved_at: null,
    refunded_at: null,
    raw_data: rawData,
  });

  if (failedPaymentResult.error) {
    console.error(failedPaymentResult.error);
  }

  const subscriptionFailResult = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: SUBSCRIPTION_STATUS.PAST_DUE,
      past_due_started_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', subscription.id);

  if (subscriptionFailResult.error) {
    console.error(subscriptionFailResult.error);
  }
}

async function chargePlanBillingSubscription({
  supabaseAdmin,
  subscription,
  now,
  nowIso,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: PlanBillingSubscriptionRow;
  now: Date;
  nowIso: string;
}) {
  const orderNo = createPaymentOrderNo('PLAN');
  const paymentKey = createPortOnePaymentKey(orderNo);

  let payment: PortOnePayment;

  try {
    const billingKey = decrypt(subscription.billing_key);

    const paymentResponse = await requestPortOneBillingPayment({
      paymentId: paymentKey,
      billingKey,
      customerId: subscription.customer_key,
      amount: subscription.price,
      orderName: '데브허브 사이트 요금제 결제',
    });

    payment = getPaymentFromResponse(paymentResponse);
    assertPaidPayment(payment);
  } catch (unknownError) {
    const failureCode = unknownError instanceof PortOneApiError ? unknownError.code : null;
    const failureMessage =
      unknownError instanceof Error ? unknownError.message || '자동결제에 실패했습니다.' : '자동결제에 실패했습니다.';
    const rawData = unknownError instanceof PortOneApiError ? unknownError.rawData : null;

    await createFailedPayment({
      supabaseAdmin,
      subscription,
      orderNo,
      failureCode,
      failureMessage,
      failureStage: unknownError instanceof PortOneApiError ? 'request_portone_billing_payment' : 'assert_paid_payment',
      rawData,
      nowIso,
    });

    return {
      ok: false,
      subscriptionId: subscription.id,
    };
  }

  const paymentInsertResult = await supabaseAdmin
    .from('payments')
    .insert({
      provider: getCurrentPortOneProvider(),
      payment_key: paymentKey,
      order_no: orderNo,
      tx_no: null,
      transaction_no: getPortOnePaymentTransactionNo(payment),
      buyer_user_id: subscription.subscriber_user_id,
      amount: getPortOnePaidAmount(payment) || subscription.price,
      refunded_amount: 0,
      currency: 'KRW',
      status: PAYMENT_STATUS.PAID,
      payment_method: PAYMENT_METHOD.CARD,
      payment_type: PAYMENT_TYPE.PLAN_BILLING,
      target_type: PAYMENT_TARGET_TYPE.PLAN,
      target_id: subscription.target_id,
      post_payment: null,
      subscription_id: subscription.id,
      failure_code: null,
      failure_message: null,
      failure_stage: null,
      refund_policy: REFUND_POLICY.SEVEN_DAYS,
      refundable_until: createRefundableUntil(now),
      approved_at: getPortOnePaidAt(payment),
      refunded_at: null,
      raw_data: payment,
    })
    .select('id')
    .single();

  if (paymentInsertResult.error) {
    console.error(paymentInsertResult.error);

    return {
      ok: false,
      subscriptionId: subscription.id,
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
      current_period_start: nextBillingPeriod.currentPeriodStart,
      current_period_end: nextBillingPeriod.currentPeriodEnd,
      next_billing_at: nextBillingPeriod.nextBillingAt,
      past_due_started_at: null,
      last_payment_id: paymentInsertResult.data.id,
      updated_at: nowIso,
    })
    .eq('id', subscription.id);

  if (subscriptionUpdateResult.error) {
    console.error(subscriptionUpdateResult.error);

    return {
      ok: false,
      subscriptionId: subscription.id,
    };
  }

  const siteOpenResult = await supabaseAdmin
    .from('rhizomes')
    .update({
      is_shutdown: false,
    })
    .eq('id', subscription.target_id);

  if (siteOpenResult.error) {
    console.error(siteOpenResult.error);

    return {
      ok: false,
      subscriptionId: subscription.id,
    };
  }

  return {
    ok: true,
    subscriptionId: subscription.id,
  };
}

export async function GET(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    if (!isValidCronRequest(request)) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const requestUrl = new URL(request.url);
    const siteId = requestUrl.searchParams.get('siteId')?.trim() ?? '';
    const now = new Date();
    const nowIso = now.toISOString();

    const baseSubscriptionQuery = supabaseAdmin
      .from('subscriptions')
      .select(
        [
          'id',
          'subscriber_user_id',
          'target_id',
          'price',
          'billing_key',
          'customer_key',
          'next_billing_at',
          'billing_anchor_day',
        ].join(', '),
      )
      .eq('subscription_type', SUBSCRIPTION_TYPE.PLAN_BILLING)
      .eq('target_type', PAYMENT_TARGET_TYPE.PLAN)
      .in('status', [SUBSCRIPTION_STATUS.TRIALING, SUBSCRIPTION_STATUS.ACTIVE])
      .is('canceled_at', null)
      .is('expired_at', null)
      .lte('next_billing_at', nowIso)
      .order('next_billing_at', { ascending: true })
      .limit(20);

    const subscriptionQuery = siteId ? baseSubscriptionQuery.eq('target_id', siteId) : baseSubscriptionQuery;
    const subscriptionsResult = await subscriptionQuery;

    if (subscriptionsResult.error) {
      console.error(subscriptionsResult.error);

      return Response.json({ error: '자동결제 대상을 불러오지 못했습니다.' }, { status: 500 });
    }

    const subscriptions = (subscriptionsResult.data ?? []) as unknown as PlanBillingSubscriptionRow[];
    const results = await Promise.all(
      subscriptions.map((subscription) =>
        chargePlanBillingSubscription({
          supabaseAdmin,
          subscription,
          now,
          nowIso,
        }),
      ),
    );

    const charged = results.filter((result) => result.ok).map((result) => result.subscriptionId);
    const failed = results.filter((result) => !result.ok).map((result) => result.subscriptionId);

    return Response.json({
      ok: true,
      checkedCount: subscriptions.length,
      chargedCount: charged.length,
      failedCount: failed.length,
      charged,
      failed,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '자동결제를 처리하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '자동결제를 처리하지 못했습니다.' }, { status: 500 });
  }
}
