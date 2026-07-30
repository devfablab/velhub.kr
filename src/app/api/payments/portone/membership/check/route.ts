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
  assertPortOnePaidPayment,
  createPortOnePaymentKey,
  getCurrentPortOneProvider,
  getPortOnePaidAmount,
  getPortOnePaidAt,
  getPortOnePayment,
  getPortOnePaymentFromResponse,
  getPortOnePaymentTransactionNo,
  PortOneApiError,
  requestPortOneBillingPayment,
} from '@/lib/payments/portone';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getMailFrom, getResendClient } from '@/lib/resend';

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
  totalAmount: number;
  status: string;
  approvedAt: string;
  currency?: string;
  transactionId?: string | null;
  rawData?: unknown;
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

async function sendMembershipBillingEmail({
  supabaseAdmin,
  subscriberUserId,
  siteId,
  amount,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscriberUserId: string;
  siteId: string;
  amount: number;
}) {
  const [subscriberResult, siteResult] = await Promise.all([
    supabaseAdmin.from('stigmas').select('email').eq('id', subscriberUserId).maybeSingle(),
    supabaseAdmin.from('rhizomes').select('site_label').eq('id', siteId).maybeSingle(),
  ]);
  const email = typeof subscriberResult.data?.email === 'string' ? subscriberResult.data.email.trim() : '';
  const siteLabel = typeof siteResult.data?.site_label === 'string' ? siteResult.data.site_label.trim() : '';

  if (!email || !siteLabel) return;

  const sendResult = await getResendClient().emails.send({
    from: getMailFrom(),
    to: email,
    subject: '[데브허브] 멤버십 자동결제가 완료되었습니다',
    html: `<table style="border-collapse:collapse;width:100%;border-style:none;margin-left:auto;margin-right:auto" border="0"><tr><td style="background-color:#181818"><div style="max-width:575px;width:100%;padding:23px;box-sizing:border-box;margin:0 auto"><img style="border-style:none" src="https://velhub.xyz/velhub-1-webmail.png" alt="데브허브" width="106" height="24"></div></td></tr><tr><td><div style="max-width:575px;width:100%;padding:23px;margin:0 auto;box-sizing:border-box;font-family:'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic','맑은 고딕',sans-serif;color:#181818"><h2>멤버십 자동결제가 완료되었습니다</h2><p>콘텐츠에 가치를 더하는 복합 허브 서비스, 데브허브입니다.</p><table style="width:100%;border-collapse:collapse"><tr><th style="width:150px;padding:12px 16px;background-color:#181818;color:#ffffff;text-align:left">사이트명</th><td style="padding:12px 16px;border:1px solid #d7d7d7">${siteLabel}</td></tr><tr><th style="width:150px;padding:12px 16px;background-color:#181818;color:#ffffff;text-align:left">결제 금액</th><td style="padding:12px 16px;border:1px solid #d7d7d7">${amount.toLocaleString('ko-KR')}원</td></tr></table><p>구독을 취소하면 현재 결제기간이 끝날 때까지 구독 혜택을 이용할 수 있으며, 다음 결제일부터 자동 결제되지 않습니다.</p><p>결제 후 7일이 지나면 환불되지 않으며, 다음 결제만 취소할 수 있습니다.</p><p><strong style="font-size:12px">Everyday, Everywhere, Everymoments - Velhub</strong></p></div></td></tr><tr><td style="background-color:#181818"><div style="max-width:575px;width:100%;padding:23px;margin:0 auto;box-sizing:border-box;font-family:'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic','맑은 고딕',sans-serif"><span style="color:#d7d7d7;font-size:12px">&copy; <img src="https://velhub.xyz/velhub-2-webmail.png" alt="데브런닷스튜디오" width="90" height="12"> All rights reserved. <strong style="color:#ff69b4;padding-left:12px">&hearts; velhub</strong></span></div></td></tr></table>`,
  });

  if (sendResult.error) throw new Error(sendResult.error.message);
}

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
}): Promise<PortOneBillingPaymentResult> {
  const paymentKey = createPortOnePaymentKey(orderId);

  await requestPortOneBillingPayment({
    paymentId: paymentKey,
    billingKey,
    customerId: customerKey,
    amount,
    orderName,
  });

  const paymentResponse = await getPortOnePayment(paymentKey);
  const payment = getPortOnePaymentFromResponse(paymentResponse);

  assertPortOnePaidPayment(payment);

  return {
    paymentKey,
    orderId,
    orderName: payment.orderName ?? orderName,
    totalAmount: getPortOnePaidAmount(payment) || amount,
    status: payment.status ?? '',
    approvedAt: getPortOnePaidAt(payment),
    currency: payment.amount?.currency ?? 'KRW',
    transactionId: getPortOnePaymentTransactionNo(payment),
    rawData: payment,
  };
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
  let paymentResult: PortOneBillingPaymentResult;

  try {
    if (!subscription.owner_user_id) {
      throw new Error('정산 대상 오너 정보가 없습니다.');
    }

    const billingKey = decrypt(subscription.billing_key);

    paymentResult = await requestPortOneBillingPaymentCompat({
      billingKey,
      customerKey: subscription.customer_key,
      amount: subscription.price,
      orderId: orderNo,
      orderName: '데브허브 블로그 멤버십',
    });
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

  if (!subscription.owner_user_id) {
    return {
      ok: false,
      subscriptionId: subscription.id,
    };
  }

  try {
    await createOwnerPaymentSplits({
      supabaseAdmin,
      paymentId: paymentInsertResult.data.id,
      siteId: subscription.target_id,
      siteOwnerUserId: subscription.owner_user_id,
      amount: paymentResult.totalAmount,
    });
  } catch (unknownError) {
    console.error(unknownError);

    return {
      ok: false,
      subscriptionId: subscription.id,
    };
  }

  try {
    await sendMembershipBillingEmail({
      supabaseAdmin,
      subscriberUserId: subscription.subscriber_user_id,
      siteId: subscription.target_id,
      amount: paymentResult.totalAmount,
    });
  } catch (emailError) {
    console.error('[payments/membership] automatic billing email error', emailError);
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

    const now = new Date();
    const nowIso = now.toISOString();

    const subscriptionsResult = await supabaseAdmin
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
      .not('next_billing_at', 'is', null)
      .lte('next_billing_at', nowIso)
      .order('next_billing_at', { ascending: true })
      .limit(20);

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
