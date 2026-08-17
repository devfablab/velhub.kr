import { NextResponse } from 'next/server';
import { cancelPortOnePayment } from '@/lib/payments/portone';
import { calculateMembershipRefundAmount } from '@/lib/payments/refunds';
import { PAYMENT_STATUS, PAYMENT_TARGET_TYPE, SUBSCRIPTION_STATUS, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

type ResumeMembershipBody = {
  membershipId?: string;
};

export async function POST(request: Request) {
  const stigma = await getCurrentStigma();

  if (!stigma) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ResumeMembershipBody | null;
  const membershipId = body?.membershipId;

  if (!membershipId) {
    return NextResponse.json({ error: 'membershipId가 유효하지 않습니다.' }, { status: 400 });
  }
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
    .eq('subscription_type', SUBSCRIPTION_TYPE.MEMBERSHIP)
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
  const update = {
    status: SUBSCRIPTION_STATUS.ACTIVE,
    canceled_at: null,
    expired_at: null,
    next_billing_at: subscription.current_period_end,
    updated_at: now,
  };

  const updateResult = await supabaseAdmin.from('subscriptions').update(update).eq('id', subscription.id);

  if (updateResult.error) {
    console.error(updateResult.error);
    return NextResponse.json({ error: '멤버십 구독 취소를 철회하지 못했습니다.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    currentPeriodEnd: subscription.current_period_end,
  });
}
