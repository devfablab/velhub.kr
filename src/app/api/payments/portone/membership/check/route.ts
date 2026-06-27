import { decrypt } from '@/lib/encryption/decrypt';
import { createNextMonthlyBillingPeriod } from '@/lib/payments/billingPeriod';
import { createPaymentOrderNo } from '@/lib/payments/orderNo';
import { getPaymentPolicyMs } from '@/lib/payments/refunds';
import { createOwnerPaymentSplits } from '@/lib/payments/splits';
import {
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PAYMENT_TARGET_TYPE,
  PAYMENT_TYPE,
  REFUND_POLICY,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TYPE,
} from '@/lib/payments/types';
import {
  getCurrentPortOneProvider,
  createPortOnePaymentKey,
  getPortOnePaidAmount,
  getPortOnePaidAt,
  getPortOnePaymentFromResponse,
  getPortOnePaymentMethod,
  getPortOnePaymentTransactionNo,
  requestPortOneBillingPayment,
  assertPortOnePaidPayment,
  PortOneApiError,
} from '@/lib/payments/portone';
import { getSupabaseAdmin } from '@/lib/supabase';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type MembershipSubscriptionRow = {
  id: string;
  subscriber_user_id: string;
  target_id: string;
  owner_user_id: string | null;
  price: number;
  billing_key: string;
  customer_key: string;
  next_billing_at: string;
  billing_anchor_day: number;
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

async function createFailedPayment({
  supabaseAdmin,
  subscription,
  orderNo,
  failureCode,
  failureMessage,
  rawData,
  nowIso,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: MembershipSubscriptionRow;
  orderNo: string;
  failureCode: string | null;
  failureMessage: string;
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
    payment_type: PAYMENT_TYPE.MEMBERSHIP_BLOG,
    target_type: PAYMENT_TARGET_TYPE.SITE,
    target_id: subscription.target_id,
    post_payment: null,
    subscription_id: subscription.id,
    failure_code: failureCode,
    failure_message: failureMessage,
    failure_stage: 'membership_check',
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

async function chargeMembershipSubscription({
  supabaseAdmin,
  subscription,
  now,
  nowIso,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: MembershipSubscriptionRow;
  now: Date;
  nowIso: string;
}) {
  const orderNo = createPaymentOrderNo('MEMBERSHIP_BLOG');

  try {
    if (!subscription.owner_user_id) {
      throw new Error('정산 대상 오너 정보가 없습니다.');
    }

    const billingKey = decrypt(subscription.billing_key);

    const paymentResult = (await requestPortOneBillingPaymentCompat({
      billingKey,
      customerKey: subscription.customer_key,
      amount: subscription.price,
      orderId: orderNo,
      orderName: '데브허브 블로그 멤버십',
    })) as PortOneBillingPaymentResult;

    const paymentInsertResult = await supabaseAdmin
      .from('payments')
      .insert({
        provider: getCurrentPortOneProvider(),
        payment_key: paymentResult.paymentKey,
        tx_no: null,
        transaction_no: paymentResult.transactionId ?? null,
        order_no: orderNo,
        buyer_user_id: subscription.subscriber_user_id,
        amount: paymentResult.totalAmount,
        refunded_amount: 0,
        currency: paymentResult.currency || 'KRW',
        status: PAYMENT_STATUS.PAID,
        payment_method: PAYMENT_METHOD.CARD,
        payment_type: PAYMENT_TYPE.MEMBERSHIP_BLOG,
        target_type: PAYMENT_TARGET_TYPE.SITE,
        target_id: subscription.target_id,
        post_payment: null,
        subscription_id: subscription.id,
        failure_code: null,
        failure_message: null,
        failure_stage: null,
        refund_policy: REFUND_POLICY.SEVEN_DAYS,
        refundable_until: createRefundableUntil(now),
        approved_at: paymentResult.approvedAt ?? nowIso,
        refunded_at: null,
        raw_data: paymentResult.rawData ?? paymentResult,
      })
      .select('id')
      .single();

    if (paymentInsertResult.error) {
      console.error(paymentInsertResult.error);

      throw new Error('멤버십 결제 내역을 저장하지 못했습니다.');
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

      throw new Error('멤버십 구독 정보를 갱신하지 못했습니다.');
    }

    await createOwnerPaymentSplits({
      supabaseAdmin,
      paymentId: paymentInsertResult.data.id,
      siteId: subscription.target_id,
      siteOwnerUserId: subscription.owner_user_id,
      amount: paymentResult.totalAmount,
    });

    return {
      ok: true,
      subscriptionId: subscription.id,
    };
  } catch (unknownError) {
    const failureCode = unknownError instanceof PortOneApiError ? unknownError.code : null;
    const failureMessage =
      unknownError instanceof Error
        ? unknownError.message || '멤버십 자동결제에 실패했습니다.'
        : '멤버십 자동결제에 실패했습니다.';
    const rawData = unknownError instanceof PortOneApiError ? unknownError.rawData : null;

    await createFailedPayment({
      supabaseAdmin,
      subscription,
      orderNo,
      failureCode,
      failureMessage,
      rawData,
      nowIso,
    });

    return {
      ok: false,
      subscriptionId: subscription.id,
    };
  }
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
          'owner_user_id',
          'price',
          'billing_key',
          'customer_key',
          'next_billing_at',
          'billing_anchor_day',
        ].join(', '),
      )
      .eq('subscription_type', SUBSCRIPTION_TYPE.MEMBERSHIP_BLOG)
      .eq('target_type', PAYMENT_TARGET_TYPE.SITE)
      .eq('status', SUBSCRIPTION_STATUS.ACTIVE)
      .is('canceled_at', null)
      .is('expired_at', null)
      .lte('next_billing_at', nowIso)
      .order('next_billing_at', { ascending: true })
      .limit(20);

    const subscriptionQuery = siteId ? baseSubscriptionQuery.eq('target_id', siteId) : baseSubscriptionQuery;
    const subscriptionsResult = await subscriptionQuery;

    if (subscriptionsResult.error) {
      console.error(subscriptionsResult.error);

      return Response.json({ error: '멤버십 자동결제 대상을 불러오지 못했습니다.' }, { status: 500 });
    }

    const subscriptions = (subscriptionsResult.data ?? []) as unknown as MembershipSubscriptionRow[];
    const results = await Promise.all(
      subscriptions.map((subscription) =>
        chargeMembershipSubscription({
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
      return Response.json(
        {
          error: unknownError.message || '멤버십 자동결제를 처리하지 못했습니다.',
        },
        { status: 500 },
      );
    }

    return Response.json({ error: '멤버십 자동결제를 처리하지 못했습니다.' }, { status: 500 });
  }
}
