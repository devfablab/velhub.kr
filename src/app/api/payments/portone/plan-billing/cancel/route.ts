import { cancelPortOnePayment } from '@/lib/payments/portone';
import { calculateSubscriptionRefundAmount } from '@/lib/payments/refunds';
import { PAYMENT_TARGET_TYPE, PAYMENT_TYPE, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type CancelPlanBillingBody = {
  siteId?: string;
};

type SubscriptionRow = {
  id: string;
  subscriber_user_id: string;
  subscription_type: string;
  target_type: string;
  target_id: string;
  price: number;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
  last_payment_id: string | null;
  current_period_start: string;
  current_period_end: string;
  next_billing_at: string | null;
  canceled_at: string | null;
  expired_at: string | null;
};

type PaymentRow = {
  id: string;
  payment_key: string | null;
  amount: number;
  refunded_amount: number;
  status: 'paid' | 'failed' | 'partially_refunded' | 'refunded';
  approved_at: string | null;
  created_at: string;
};

async function getLastPayment({
  supabaseAdmin,
  subscription,
  siteId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: SubscriptionRow;
  siteId: string;
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CancelPlanBillingBody;
    const siteId = normalizeText(body.siteId);

    if (!siteId) {
      return Response.json({ error: 'siteId가 유효하지 않습니다.' }, { status: 400 });
    }

    const session = await verifySession({ siteId });

    if (session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const now = new Date();
    const nowText = now.toISOString();

    const subscriptionResult = await supabaseAdmin
      .from('subscriptions')
      .select(
        [
          'id',
          'subscriber_user_id',
          'subscription_type',
          'target_type',
          'target_id',
          'price',
          'status',
          'last_payment_id',
          'current_period_start',
          'current_period_end',
          'next_billing_at',
          'canceled_at',
          'expired_at',
        ].join(', '),
      )
      .eq('subscription_type', SUBSCRIPTION_TYPE.PLAN_BILLING)
      .eq('target_type', PAYMENT_TARGET_TYPE.PLAN)
      .eq('target_id', siteId)
      .in('status', ['trialing', 'active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionResult.error) {
      console.error(subscriptionResult.error);

      return Response.json({ error: '구독 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!subscriptionResult.data) {
      return Response.json({ error: '취소할 요금제 구독을 찾을 수 없습니다.' }, { status: 404 });
    }

    const subscription = subscriptionResult.data as unknown as SubscriptionRow;

    if (subscription.canceled_at && subscription.next_billing_at === null) {
      return Response.json({ error: '이미 취소된 요금제 구독입니다.' }, { status: 400 });
    }

    const payment = await getLastPayment({
      supabaseAdmin,
      subscription,
      siteId,
    });

    if (!payment) {
      const subscriptionUpdateResult = await supabaseAdmin
        .from('subscriptions')
        .update({
          status: 'canceled',
          next_billing_at: null,
          canceled_at: nowText,
          expired_at: nowText,
          updated_at: nowText,
        })
        .eq('id', subscription.id);

      if (subscriptionUpdateResult.error) {
        console.error(subscriptionUpdateResult.error);

        return Response.json({ error: '요금제 구독을 취소하지 못했습니다.' }, { status: 500 });
      }

      const siteCloseResult = await supabaseAdmin
        .from('rhizomes')
        .update({
          is_shutdown: true,
        })
        .eq('id', siteId);

      if (siteCloseResult.error) {
        console.error(siteCloseResult.error);

        return Response.json({ error: '사이트를 닫지 못했습니다.' }, { status: 500 });
      }

      return Response.json({
        ok: true,
        mode: 'canceled_without_payment',
        refundAmount: 0,
        retainedAmount: 0,
      });
    }

    if (payment.status === 'refunded') {
      return Response.json({ error: '이미 환불된 결제입니다.' }, { status: 400 });
    }

    if (payment.refunded_amount > 0) {
      return Response.json({ error: '이미 일부 환불된 결제입니다.' }, { status: 400 });
    }

    const paidAt = payment.approved_at ?? payment.created_at;
    const refundCalculation = calculateSubscriptionRefundAmount({
      amount: payment.amount,
      paidAt,
      now,
    });

    if (!refundCalculation.isRefundable) {
      const subscriptionUpdateResult = await supabaseAdmin
        .from('subscriptions')
        .update({
          next_billing_at: null,
          canceled_at: nowText,
          updated_at: nowText,
        })
        .eq('id', subscription.id);

      if (subscriptionUpdateResult.error) {
        console.error(subscriptionUpdateResult.error);

        return Response.json({ error: '요금제 구독 취소를 예약하지 못했습니다.' }, { status: 500 });
      }

      return Response.json({
        ok: true,
        mode: 'cancel_scheduled',
        refundAmount: 0,
        retainedAmount: payment.amount,
      });
    }

    if (!payment.payment_key) {
      return Response.json({ error: '결제 취소에 필요한 paymentId가 없습니다.' }, { status: 400 });
    }

    const cancelResult = await cancelPortOnePayment({
      paymentId: payment.payment_key,
      cancelReason: '요금제 구독 환불',
      cancelAmount: refundCalculation.isFullRefund ? undefined : refundCalculation.refundAmount,
    });

    const paymentStatus = refundCalculation.refundAmount >= payment.amount ? 'refunded' : 'partially_refunded';

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
      console.error(paymentUpdateResult.error);

      return Response.json({ error: '결제 환불 정보를 저장하지 못했습니다.' }, { status: 500 });
    }

    const subscriptionUpdateResult = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'canceled',
        next_billing_at: null,
        canceled_at: nowText,
        expired_at: nowText,
        updated_at: nowText,
      })
      .eq('id', subscription.id);

    if (subscriptionUpdateResult.error) {
      console.error(subscriptionUpdateResult.error);

      return Response.json({ error: '요금제 구독 정보를 갱신하지 못했습니다.' }, { status: 500 });
    }

    const siteCloseResult = await supabaseAdmin
      .from('rhizomes')
      .update({
        is_shutdown: true,
      })
      .eq('id', siteId);

    if (siteCloseResult.error) {
      console.error(siteCloseResult.error);

      return Response.json({ error: '사이트를 닫지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      mode: refundCalculation.isFullRefund ? 'full_refund' : 'partial_refund',
      refundAmount: refundCalculation.refundAmount,
      retainedAmount: refundCalculation.retainedAmount,
      usedDays: refundCalculation.usedDays,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '요금제 구독 취소에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '요금제 구독 취소에 실패했습니다.' }, { status: 500 });
  }
}
