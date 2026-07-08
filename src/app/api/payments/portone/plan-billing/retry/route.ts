import { NextRequest } from 'next/server';
import { decrypt } from '@/lib/encryption/decrypt';
import { createNextMonthlyBillingPeriod } from '@/lib/payments/billingPeriod';
import { createPaymentOrderNo } from '@/lib/payments/orderNo';
import {
  PortOneApiError,
  assertPortOnePaidPayment,
  createPortOnePaymentKey,
  getCurrentPortOneProvider,
  getPortOnePaidAmount,
  getPortOnePaidAt,
  getPortOnePaymentFromResponse,
  getPortOnePaymentTransactionNo,
  requestPortOneBillingPayment,
  type PortOnePayment,
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
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RequestBody = {
  siteId?: string;
};

type PlanBillingSubscriptionRow = {
  id: string;
  subscriber_user_id: string;
  target_id: string;
  price: number;
  billing_key: string;
  customer_key: string;
  billing_anchor_day: number;
};

function createRefundableUntil(startedAt: Date) {
  return new Date(startedAt.getTime() + getPaymentPolicyMs()).toISOString();
}

function getFailureStage(unknownError: unknown) {
  if (unknownError instanceof PortOneApiError) {
    return 'request_portone_billing_payment';
  }

  return 'assert_paid_payment';
}

async function createRetryFailedPayment({
  subscription,
  orderNo,
  unknownError,
}: {
  subscription: PlanBillingSubscriptionRow;
  orderNo: string;
  unknownError: unknown;
}) {
  const supabaseAdmin = getSupabaseAdmin();

  const failureCode = unknownError instanceof PortOneApiError ? unknownError.code : null;
  const failureMessage =
    unknownError instanceof Error
      ? unknownError.message || '결제 재시도에 실패했습니다.'
      : '결제 재시도에 실패했습니다.';
  const rawData = unknownError instanceof PortOneApiError ? unknownError.rawData : null;

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
    failure_stage: getFailureStage(unknownError),
    refund_policy: REFUND_POLICY.SEVEN_DAYS,
    refundable_until: null,
    approved_at: null,
    refunded_at: null,
    raw_data: rawData,
  });

  if (failedPaymentResult.error) {
    console.error(failedPaymentResult.error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const requestBody = (await request.json()) as RequestBody;
    const siteId = normalizeText(requestBody.siteId);

    if (!siteId) {
      return Response.json({ error: 'siteId가 유효하지 않습니다.' }, { status: 400 });
    }

    const session = await verifySession({ siteId });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const subscriptionResult = await supabaseAdmin
      .from('subscriptions')
      .select(
        ['id', 'subscriber_user_id', 'target_id', 'price', 'billing_key', 'customer_key', 'billing_anchor_day'].join(
          ', ',
        ),
      )
      .eq('subscription_type', SUBSCRIPTION_TYPE.PLAN_BILLING)
      .eq('target_type', PAYMENT_TARGET_TYPE.PLAN)
      .eq('target_id', siteId)
      .eq('status', SUBSCRIPTION_STATUS.PAST_DUE)
      .is('canceled_at', null)
      .is('expired_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionResult.error) {
      console.error(subscriptionResult.error);
      return Response.json({ error: '구독 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!subscriptionResult.data) {
      return Response.json({ error: '결제 재시도 대상 구독이 없습니다.' }, { status: 404 });
    }

    const subscription = subscriptionResult.data as unknown as PlanBillingSubscriptionRow;
    const now = new Date();
    const nowIso = now.toISOString();
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
        orderName: '데브허브 사이트 요금제 결제 재시도',
      });

      payment = getPortOnePaymentFromResponse(paymentResponse);
      assertPortOnePaidPayment(payment);
    } catch (unknownError) {
      await createRetryFailedPayment({
        subscription,
        orderNo,
        unknownError,
      });

      return Response.json({ error: '결제 재시도에 실패했습니다.' }, { status: 400 });
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
      return Response.json({ error: '결제 내역을 저장하지 못했습니다.' }, { status: 500 });
    }

    const nextBillingPeriod = createNextMonthlyBillingPeriod({
      currentPeriodEnd: nowIso,
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
      return Response.json({ error: '구독 정보를 갱신하지 못했습니다.' }, { status: 500 });
    }

    const siteOpenResult = await supabaseAdmin
      .from('rhizomes')
      .update({
        is_shutdown: false,
      })
      .eq('id', subscription.target_id);

    if (siteOpenResult.error) {
      console.error(siteOpenResult.error);
      return Response.json({ error: '사이트 상태를 갱신하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      subscriptionId: subscription.id,
      paymentId: paymentInsertResult.data.id,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '결제 재시도에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '결제 재시도에 실패했습니다.' }, { status: 500 });
  }
}
