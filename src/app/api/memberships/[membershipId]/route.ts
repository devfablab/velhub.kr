import { NextResponse } from 'next/server';
import { cancelPortOnePayment } from '@/lib/payments/portone';
import { calculateMembershipRefundAmount } from '@/lib/payments/refunds';
import {
  PAYMENT_STATUS,
  PAYMENT_TARGET_TYPE,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TYPE,
} from '@/lib/payments/types';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

type RouteContext = {
  params: Promise<{ membershipId: string }>;
};

type MembershipAction = 'cancel' | 'resume';

export async function PATCH(request: Request, { params }: RouteContext) {
  const stigma = await getCurrentStigma();

  if (!stigma) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { action?: MembershipAction } | null;

  if (body?.action !== 'cancel' && body?.action !== 'resume') {
    return NextResponse.json({ error: '요청을 처리할 수 없습니다.' }, { status: 400 });
  }

  const { membershipId } = await params;
  const supabaseAdmin = getSupabaseAdmin();
  const membershipResult = await supabaseAdmin
    .from('memberships')
    .select('id')
    .eq('id', membershipId)
    .eq('user_id', stigma.stigmaId)
    .maybeSingle();

  if (membershipResult.error) {
    console.error(membershipResult.error);
    return NextResponse.json({ error: '멤버십 정보를 확인하지 못했습니다.' }, { status: 500 });
  }

  if (!membershipResult.data) {
    return NextResponse.json({ error: '변경할 멤버십을 찾을 수 없습니다.' }, { status: 404 });
  }

  const subscriptionResult = await supabaseAdmin
    .from('subscriptions')
    .select('id,status,current_period_end')
    .eq('subscriber_user_id', stigma.stigmaId)
    .eq('subscription_type', SUBSCRIPTION_TYPE.MEMBERSHIP_PLATFORM)
    .eq('target_type', PAYMENT_TARGET_TYPE.MEMBERSHIP)
    .eq('target_id', membershipId)
    .in('status', [
      SUBSCRIPTION_STATUS.TRIALING,
      SUBSCRIPTION_STATUS.ACTIVE,
      SUBSCRIPTION_STATUS.PAST_DUE,
      SUBSCRIPTION_STATUS.CANCELED,
    ])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionResult.error) {
    console.error(subscriptionResult.error);
    return NextResponse.json({ error: '멤버십 구독 정보를 확인하지 못했습니다.' }, { status: 500 });
  }

  const subscription = subscriptionResult.data;

  if (!subscription) {
    return NextResponse.json({ error: '변경할 멤버십 구독을 찾을 수 없습니다.' }, { status: 404 });
  }

  const currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;

  if (!currentPeriodEnd || Number.isNaN(currentPeriodEnd.getTime()) || currentPeriodEnd <= new Date()) {
    return NextResponse.json({ error: '현재 이용 기간이 끝난 멤버십입니다.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const update =
    body.action === 'cancel'
      ? {
          status: SUBSCRIPTION_STATUS.CANCELED,
          canceled_at: now,
          next_billing_at: null,
          updated_at: now,
        }
      : {
          status: SUBSCRIPTION_STATUS.ACTIVE,
          canceled_at: null,
          expired_at: null,
          next_billing_at: subscription.current_period_end,
          updated_at: now,
        };

  const updateResult = await supabaseAdmin.from('subscriptions').update(update).eq('id', subscription.id);

  if (updateResult.error) {
    console.error(updateResult.error);
    return NextResponse.json(
      { error: body.action === 'cancel' ? '멤버십 구독을 취소하지 못했습니다.' : '멤버십 구독 취소를 철회하지 못했습니다.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    status: body.action === 'cancel' ? SUBSCRIPTION_STATUS.CANCELED : SUBSCRIPTION_STATUS.ACTIVE,
    currentPeriodEnd: subscription.current_period_end,
  });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const stigma = await getCurrentStigma();

  if (!stigma) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { membershipId } = await params;
  const supabaseAdmin = getSupabaseAdmin();
  const membershipResult = await supabaseAdmin
    .from('memberships')
    .select('id')
    .eq('id', membershipId)
    .eq('user_id', stigma.stigmaId)
    .maybeSingle();

  if (membershipResult.error) {
    console.error(membershipResult.error);
    return NextResponse.json({ error: '멤버십 정보를 확인하지 못했습니다.' }, { status: 500 });
  }

  if (!membershipResult.data) {
    return NextResponse.json({ error: '해지할 멤버십을 찾을 수 없습니다.' }, { status: 404 });
  }

  const subscriptionResult = await supabaseAdmin
    .from('subscriptions')
    .select('id,last_payment_id,current_period_end')
    .eq('subscriber_user_id', stigma.stigmaId)
    .eq('subscription_type', SUBSCRIPTION_TYPE.MEMBERSHIP_PLATFORM)
    .eq('target_type', PAYMENT_TARGET_TYPE.MEMBERSHIP)
    .eq('target_id', membershipId)
    .in('status', [
      SUBSCRIPTION_STATUS.TRIALING,
      SUBSCRIPTION_STATUS.ACTIVE,
      SUBSCRIPTION_STATUS.PAST_DUE,
      SUBSCRIPTION_STATUS.CANCELED,
    ])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionResult.error) {
    console.error(subscriptionResult.error);
    return NextResponse.json({ error: '멤버십 결제 정보를 확인하지 못했습니다.' }, { status: 500 });
  }

  const subscription = subscriptionResult.data;
  let refundAmount = 0;

  if (subscription?.last_payment_id) {
    const paymentResult = await supabaseAdmin
      .from('payments')
      .select('id,payment_key,amount,refunded_amount,status,approved_at,created_at')
      .eq('id', subscription.last_payment_id)
      .maybeSingle();

    if (paymentResult.error) {
      console.error(paymentResult.error);
      return NextResponse.json({ error: '멤버십 결제 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const payment = paymentResult.data;

    if (payment && payment.status === PAYMENT_STATUS.PAID && Number(payment.refunded_amount ?? 0) === 0) {
      if (!payment.payment_key) {
        return NextResponse.json({ error: '결제 취소에 필요한 paymentId가 없습니다.' }, { status: 400 });
      }

      const refund = calculateMembershipRefundAmount({
        amount: Number(payment.amount),
        paidAt: payment.approved_at ?? payment.created_at,
        now: new Date(),
      });

      if (refund.refundAmount > 0) {
        const cancelResult = await cancelPortOnePayment({
          paymentId: payment.payment_key,
          cancelReason: '멤버십 해지 및 환불',
          cancelAmount: refund.isFullRefund ? undefined : refund.refundAmount,
        });
        const status = refund.refundAmount >= Number(payment.amount) ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIALLY_REFUNDED;
        const paymentUpdateResult = await supabaseAdmin
          .from('payments')
          .update({
            status,
            refunded_amount: refund.refundAmount,
            refunded_at: new Date().toISOString(),
            raw_data: cancelResult,
          })
          .eq('id', payment.id);

        if (paymentUpdateResult.error) {
          console.error(paymentUpdateResult.error);
          return NextResponse.json({ error: '멤버십 환불 정보를 저장하지 못했습니다.' }, { status: 500 });
        }

        refundAmount = refund.refundAmount;
      }
    }
  }

  const now = new Date().toISOString();

  if (subscription) {
    const subscriptionUpdateResult = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: SUBSCRIPTION_STATUS.CANCELED,
        canceled_at: now,
        expired_at: now,
        next_billing_at: null,
        updated_at: now,
      })
      .eq('id', subscription.id);

    if (subscriptionUpdateResult.error) {
      console.error(subscriptionUpdateResult.error);
      return NextResponse.json({ error: '멤버십 구독을 해지하지 못했습니다.' }, { status: 500 });
    }
  }

  const itemDeleteResult = await supabaseAdmin.from('membership_items').delete().eq('membership_id', membershipId);

  if (itemDeleteResult.error) {
    console.error(itemDeleteResult.error);
    return NextResponse.json({ error: '멤버십 기능을 해지하지 못했습니다.' }, { status: 500 });
  }

  const membershipDeleteResult = await supabaseAdmin.from('memberships').delete().eq('id', membershipId).eq('user_id', stigma.stigmaId);

  if (membershipDeleteResult.error) {
    console.error(membershipDeleteResult.error);
    return NextResponse.json({ error: '멤버십을 해지하지 못했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, refundAmount });
}
