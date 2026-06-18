import { decrypt } from '@/lib/encryption/decrypt';
import { createNextMonthlyBillingPeriod } from '@/lib/payments/billingPeriod';
import { createPaymentOrderNo } from '@/lib/payments/orderNo';
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
import { requestTossBillingPayment, TossBillingPaymentError } from '@/lib/payments/toss';
import { getSupabaseAdmin } from '@/lib/supabase';

type MembershipSubscriptionRow = {
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

function createOrderNo() {
  return createPaymentOrderNo('BLOG_MEMBERSHIP');
}

function addSevenDays(date: Date) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + 7);

  return nextDate;
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

    let subscriptionQuery = supabaseAdmin
      .from('subscriptions')
      .select(
        'id, subscriber_user_id, target_id, price, billing_key, customer_key, next_billing_at, billing_anchor_day',
      )
      .eq('subscription_type', SUBSCRIPTION_TYPE.BLOG_MEMBERSHIP)
      .eq('target_type', PAYMENT_TARGET_TYPE.BLOG)
      .eq('status', SUBSCRIPTION_STATUS.ACTIVE)
      .is('canceled_at', null)
      .is('expired_at', null)
      .lte('next_billing_at', nowIso)
      .order('next_billing_at', { ascending: true })
      .limit(20);

    if (siteId) {
      subscriptionQuery = subscriptionQuery.eq('target_id', siteId);
    }

    const subscriptionsResult = await subscriptionQuery;

    if (subscriptionsResult.error) {
      console.error(subscriptionsResult.error);

      return Response.json({ error: '멤버십 자동결제 대상을 불러오지 못했습니다.' }, { status: 500 });
    }

    const subscriptions = (subscriptionsResult.data ?? []) as unknown as MembershipSubscriptionRow[];
    const charged: string[] = [];
    const failed: string[] = [];

    for (const subscription of subscriptions) {
      const orderNo = createOrderNo();
      const refundableUntil = addSevenDays(now);

      try {
        const billingKey = decrypt(subscription.billing_key);

        const paymentResult = await requestTossBillingPayment({
          billingKey,
          customerKey: subscription.customer_key,
          amount: subscription.price,
          orderId: orderNo,
          orderName: '데브허브 블로그 멤버십',
        });

        const paymentInsertResult = await supabaseAdmin
          .from('payments')
          .insert({
            provider: PAYMENT_PROVIDER.TOSS,
            payment_key: paymentResult.paymentKey,
            order_no: orderNo,
            buyer_user_id: subscription.subscriber_user_id,
            amount: paymentResult.totalAmount,
            refunded_amount: 0,
            currency: paymentResult.currency || 'KRW',
            status: PAYMENT_STATUS.PAID,
            payment_method: PAYMENT_METHOD.CARD,
            payment_type: PAYMENT_TYPE.BLOG_MEMBERSHIP,
            target_type: PAYMENT_TARGET_TYPE.BLOG,
            target_id: subscription.target_id,
            subscription_id: subscription.id,
            failure_code: null,
            failure_message: null,
            failure_stage: null,
            refund_policy: REFUND_POLICY.SEVEN_DAYS,
            refundable_until: refundableUntil.toISOString(),
            approved_at: paymentResult.approvedAt ?? nowIso,
            refunded_at: null,
            raw_data: paymentResult,
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

        charged.push(subscription.id);
      } catch (unknownError) {
        const failureCode = unknownError instanceof TossBillingPaymentError ? unknownError.code : null;
        const failureMessage =
          unknownError instanceof Error
            ? unknownError.message || '멤버십 자동결제에 실패했습니다.'
            : '멤버십 자동결제에 실패했습니다.';
        const rawData = unknownError instanceof TossBillingPaymentError ? unknownError.rawData : null;

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
          payment_type: PAYMENT_TYPE.BLOG_MEMBERSHIP,
          target_type: PAYMENT_TARGET_TYPE.BLOG,
          target_id: subscription.target_id,
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

        failed.push(subscription.id);
      }
    }

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
        { error: unknownError.message || '멤버십 자동결제를 처리하지 못했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '멤버십 자동결제를 처리하지 못했습니다.' }, { status: 500 });
  }
}
