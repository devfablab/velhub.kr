import { cancelPortOnePayment } from '@/lib/payments/portone';
import { calculateSubscriptionRefundAmount } from '@/lib/payments/refunds';
import { PAYMENT_TARGET_TYPE, PAYMENT_TYPE, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import { getSupabaseAdmin } from '@/lib/supabase';

type SubscriptionRow = {
  id: string;
  status: string;
  last_payment_id: string | null;
  price: number;
};

type PaymentRow = {
  id: string;
  payment_key: string | null;
  amount: number;
  refunded_amount: number;
  status: string;
  approved_at: string | null;
  created_at: string;
};

async function getLastPayment(siteId: string, subscription: SubscriptionRow) {
  const supabaseAdmin = getSupabaseAdmin();

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

  const paymentResult = await supabaseAdmin
    .from('payments')
    .select('id, payment_key, amount, refunded_amount, status, approved_at, created_at')
    .eq('payment_type', PAYMENT_TYPE.PLAN_BILLING)
    .eq('target_type', PAYMENT_TARGET_TYPE.PLAN)
    .eq('target_id', siteId)
    .in('status', ['paid', 'partially_refunded'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentResult.error) {
    throw new Error('결제 정보를 확인하지 못했습니다.');
  }

  return (paymentResult.data as PaymentRow | null) ?? null;
}

export async function forceTerminateSitePlan(siteId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const now = new Date();
  const nowIsoString = now.toISOString();
  const subscriptionResult = await supabaseAdmin
    .from('subscriptions')
    .select('id, status, last_payment_id, price')
    .eq('subscription_type', SUBSCRIPTION_TYPE.PLAN_BILLING)
    .eq('target_type', PAYMENT_TARGET_TYPE.PLAN)
    .eq('target_id', siteId)
    .in('status', ['trialing', 'active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionResult.error) {
    throw new Error('요금제 구독 정보를 확인하지 못했습니다.');
  }

  if (!subscriptionResult.data) {
    return {
      mode: 'no_subscription' as const,
      refundAmount: 0,
    };
  }

  const subscription = subscriptionResult.data as SubscriptionRow;
  const payment = await getLastPayment(siteId, subscription);

  if (!payment || subscription.status === 'trialing') {
    const cancelResult = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'canceled',
        next_billing_at: null,
        canceled_at: nowIsoString,
        expired_at: nowIsoString,
        updated_at: nowIsoString,
      })
      .eq('id', subscription.id);

    if (cancelResult.error) {
      throw new Error('요금제 구독을 취소하지 못했습니다.');
    }

    return {
      mode: 'canceled' as const,
      refundAmount: 0,
    };
  }

  if (payment.status === 'refunded' || Number(payment.refunded_amount ?? 0) > 0) {
    const cancelResult = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'canceled',
        next_billing_at: null,
        canceled_at: nowIsoString,
        expired_at: nowIsoString,
        updated_at: nowIsoString,
      })
      .eq('id', subscription.id);

    if (cancelResult.error) {
      throw new Error('요금제 구독을 취소하지 못했습니다.');
    }

    return {
      mode: 'canceled_after_previous_refund' as const,
      refundAmount: Number(payment.refunded_amount ?? 0),
    };
  }

  const refundCalculation = calculateSubscriptionRefundAmount({
    amount: payment.amount,
    paidAt: payment.approved_at ?? payment.created_at,
    now,
  });

  if (!refundCalculation.isRefundable) {
    const cancelResult = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'scheduled_cancel',
        next_billing_at: null,
        canceled_at: nowIsoString,
        expired_at: null,
        updated_at: nowIsoString,
      })
      .eq('id', subscription.id);

    if (cancelResult.error) {
      throw new Error('다음 요금제 결제를 취소하지 못했습니다.');
    }

    return {
      mode: 'cancel_scheduled' as const,
      refundAmount: 0,
    };
  }

  if (!payment.payment_key) {
    throw new Error('환불에 필요한 결제 정보가 없습니다.');
  }

  const cancelResult = await cancelPortOnePayment({
    paymentId: payment.payment_key,
    cancelReason: '컨시어지팀 사이트 강제폐쇄에 따른 요금제 환불',
    cancelAmount: refundCalculation.isFullRefund ? undefined : refundCalculation.refundAmount,
  });
  const paymentStatus = refundCalculation.isFullRefund ? 'refunded' : 'partially_refunded';
  const paymentUpdateResult = await supabaseAdmin
    .from('payments')
    .update({
      status: paymentStatus,
      refunded_amount: refundCalculation.refundAmount,
      refunded_at: nowIsoString,
      raw_data: cancelResult,
    })
    .eq('id', payment.id);

  if (paymentUpdateResult.error) {
    throw new Error('결제 환불 정보를 저장하지 못했습니다.');
  }

  const subscriptionUpdateResult = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'canceled',
      next_billing_at: null,
      canceled_at: nowIsoString,
      expired_at: nowIsoString,
      updated_at: nowIsoString,
    })
    .eq('id', subscription.id);

  if (subscriptionUpdateResult.error) {
    throw new Error('요금제 구독 정보를 갱신하지 못했습니다.');
  }

  return {
    mode: refundCalculation.isFullRefund ? ('full_refund' as const) : ('partial_refund' as const),
    refundAmount: refundCalculation.refundAmount,
  };
}
