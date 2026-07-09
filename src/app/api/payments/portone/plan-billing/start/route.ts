import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { encrypt } from '@/lib/encryption/encrypt';
import {
  createMonthlyBillingPeriod,
  createNextMonthlyBillingPeriod,
  getBillingAnchorDay,
} from '@/lib/payments/billingPeriod';
import { createPaymentOrderNo } from '@/lib/payments/orderNo';
import {
  assertPaidPayment,
  assertPortOnePaidPayment,
  createPortOnePaymentKey,
  getCurrentPortOneProvider,
  getPortOneKpnSubscriptionChannelKey,
  getPortOnePaidAmount,
  getPortOnePaidAt,
  getPortOnePayment,
  getPortOnePaymentFromResponse,
  getPortOnePaymentMethod,
  getPortOnePaymentTransactionNo,
  getPortOneStoreId,
  requestPortOneBillingPayment,
  type PortOnePayment,
  type PortOnePaymentResponse,
} from '@/lib/payments/portone';
import { getPaymentPolicyMs } from '@/lib/payments/refunds';
import { createCustomerKey, getPaymentCustomerName } from '@/lib/payments/customer';
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

type PlanBillingStartBody = {
  siteId?: string;
  orderName?: string;
  successUrl?: string;
  failUrl?: string;
  purpose?: 'plan_subscription' | 'billing_method';
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  plan_type: string | null;
};

type PlanRow = {
  id: string;
  plan_label: string;
  price: number;
};

type BillingMethodRow = {
  id: string;
  customer_key: string;
  billing_key: string;
};

type SubscriptionRow = {
  id: string;
  status: string;
  current_period_end: string | null;
  next_billing_at: string | null;
  canceled_at: string | null;
  expired_at: string | null;
};

function getSafeRedirectUrl(request: NextRequest, url: string | undefined) {
  if (!url) {
    throw new Error('이동할 주소가 없습니다.');
  }

  const parsedUrl = new URL(url, request.nextUrl.origin);

  if (parsedUrl.origin !== request.nextUrl.origin) {
    throw new Error('이동할 주소가 올바르지 않습니다.');
  }

  return parsedUrl;
}

function isOpenSubscription(subscription: SubscriptionRow | null) {
  if (!subscription) {
    return false;
  }

  if (subscription.expired_at) {
    return false;
  }

  if (subscription.canceled_at) {
    return false;
  }

  return (
    subscription.status === SUBSCRIPTION_STATUS.TRIALING ||
    subscription.status === SUBSCRIPTION_STATUS.ACTIVE ||
    subscription.status === SUBSCRIPTION_STATUS.PAST_DUE
  );
}

function isScheduledCancelSubscription(subscription: SubscriptionRow | null, now: Date) {
  if (!subscription) {
    return false;
  }

  if (!subscription.canceled_at) {
    return false;
  }

  if (subscription.expired_at) {
    return false;
  }

  if (!subscription.current_period_end) {
    return false;
  }

  return new Date(subscription.current_period_end).getTime() > now.getTime();
}

function createRefundableUntil(startedAt: Date) {
  return new Date(startedAt.getTime() + getPaymentPolicyMs()).toISOString();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PlanBillingStartBody;
    const siteId = normalizeText(body.siteId);
    const orderName = normalizeText(body.orderName) || '데브허브 사이트 요금제 결제수단 등록';
    const purpose = body.purpose === 'billing_method' ? 'billing_method' : 'plan_subscription';

    if (!siteId) {
      return Response.json({ error: 'siteId가 유효하지 않습니다.' }, { status: 400 });
    }

    const successUrl = getSafeRedirectUrl(request, body.successUrl);
    const failUrl = getSafeRedirectUrl(request, body.failUrl);

    const session = await verifySession({ siteId });

    if (session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const siteResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label, plan_type')
      .eq('id', siteId)
      .maybeSingle();

    if (siteResult.error) {
      console.error(siteResult.error);

      return Response.json({ error: '사이트 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!siteResult.data) {
      return Response.json({ error: '사이트 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const site = siteResult.data as SiteRow;

    if (!site.plan_type) {
      return Response.json({ error: '사이트 요금제가 설정되지 않았습니다.' }, { status: 400 });
    }

    const planResult = await supabaseAdmin
      .from('plans')
      .select('id, plan_label, price')
      .eq('id', site.plan_type)
      .maybeSingle();

    if (planResult.error) {
      console.error(planResult.error);

      return Response.json({ error: '요금제 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!planResult.data) {
      return Response.json({ error: '요금제 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const plan = planResult.data as PlanRow;

    const latestSubscriptionResult = await supabaseAdmin
      .from('subscriptions')
      .select('id, status, current_period_end, next_billing_at, canceled_at, expired_at')
      .eq('subscription_type', SUBSCRIPTION_TYPE.PLAN_BILLING)
      .eq('target_type', PAYMENT_TARGET_TYPE.PLAN)
      .eq('target_id', site.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestSubscriptionResult.error) {
      console.error(latestSubscriptionResult.error);

      return Response.json({ error: '기존 요금제 구독 상태를 확인하지 못했습니다.' }, { status: 500 });
    }

    const latestSubscription = (latestSubscriptionResult.data as SubscriptionRow | null) ?? null;
    const now = new Date();
    const customerKey = createCustomerKey(session.authUserId);
    const customerName = await getPaymentCustomerName(session.authUserId);
    const orderNo = createPaymentOrderNo('PLAN');

    if (purpose !== 'billing_method' && isOpenSubscription(latestSubscription)) {
      return Response.json({ error: '이미 요금제 구독이 등록되어 있습니다.' }, { status: 400 });
    }

    const scheduledCancelSubscription =
      purpose !== 'billing_method' && isScheduledCancelSubscription(latestSubscription, now)
        ? latestSubscription
        : null;

    if (scheduledCancelSubscription) {
      const subscriptionUpdateResult = await supabaseAdmin
        .from('subscriptions')
        .update({
          canceled_at: null,
          next_billing_at: scheduledCancelSubscription.current_period_end,
          updated_at: now.toISOString(),
        })
        .eq('id', scheduledCancelSubscription.id);

      if (subscriptionUpdateResult.error) {
        console.error(subscriptionUpdateResult.error);

        return Response.json({ error: '요금제 구독 취소를 철회하지 못했습니다.' }, { status: 500 });
      }

      const siteOpenResult = await supabaseAdmin
        .from('rhizomes')
        .update({
          is_shutdown: false,
        })
        .eq('id', site.id);

      if (siteOpenResult.error) {
        console.error(siteOpenResult.error);

        return Response.json({ error: '사이트 상태를 갱신하지 못했습니다.' }, { status: 500 });
      }

      return Response.json({
        mode: 'resume_scheduled_cancel',
        ok: true,
        subscriptionId: scheduledCancelSubscription.id,
        nextBillingAt: scheduledCancelSubscription.current_period_end,
      });
    }

    if (purpose === 'billing_method') {
      successUrl.searchParams.set('siteId', site.id);
      successUrl.searchParams.set('orderNo', orderNo);
      successUrl.searchParams.set('customerKey', customerKey);
      successUrl.searchParams.set('purpose', purpose);

      failUrl.searchParams.set('siteId', site.id);
      failUrl.searchParams.set('orderNo', orderNo);
      failUrl.searchParams.set('purpose', purpose);

      return Response.json({
        mode: 'billing_auth',
        storeId: getPortOneStoreId(),
        channelKey: getPortOneKpnSubscriptionChannelKey(),
        customerKey,
        customerName,
        orderNo,
        orderName,
        successUrl: successUrl.toString(),
        failUrl: failUrl.toString(),
      });
    }

    const billingMethodResult = await supabaseAdmin
      .from('subscription_billing_methods')
      .select('id, customer_key, billing_key')
      .eq('user_id', session.authUserId)
      .eq('provider', getCurrentPortOneProvider())
      .eq('is_default', true)
      .limit(1);

    if (billingMethodResult.error) {
      console.error(billingMethodResult.error);

      return Response.json({ error: '등록된 결제수단을 확인하지 못했습니다.' }, { status: 500 });
    }

    const billingMethods = (billingMethodResult.data ?? []) as unknown as BillingMethodRow[];
    const billingMethod = billingMethods[0] ?? null;
    const shouldUseTrial = !latestSubscription;

    if (!billingMethod) {
      successUrl.searchParams.set('siteId', site.id);
      successUrl.searchParams.set('orderNo', orderNo);
      successUrl.searchParams.set('customerKey', customerKey);
      successUrl.searchParams.set('purpose', purpose);

      failUrl.searchParams.set('siteId', site.id);
      failUrl.searchParams.set('orderNo', orderNo);
      failUrl.searchParams.set('paymentType', PAYMENT_TYPE.PLAN_BILLING);
      failUrl.searchParams.set('purpose', purpose);

      return Response.json({
        mode: 'billing_auth',
        storeId: getPortOneStoreId(),
        channelKey: getPortOneKpnSubscriptionChannelKey(),
        customerKey,
        customerName,
        orderNo,
        orderName,
        successUrl: successUrl.toString(),
        failUrl: failUrl.toString(),
      });
    }

    if (shouldUseTrial) {
      const billingPeriod = createMonthlyBillingPeriod({
        startedAt: now,
      });

      const subscriptionInsertResult = await supabaseAdmin
        .from('subscriptions')
        .insert({
          subscriber_user_id: session.authUserId,
          subscription_type: SUBSCRIPTION_TYPE.PLAN_BILLING,
          target_type: PAYMENT_TARGET_TYPE.PLAN,
          target_id: site.id,
          owner_user_id: null,
          price: plan.price,
          status: SUBSCRIPTION_STATUS.TRIALING,
          billing_key: encrypt(billingMethod.billing_key),
          customer_key: billingMethod.customer_key,
          last_payment_id: null,
          trial_started_at: billingPeriod.currentPeriodStart,
          trial_ends_at: billingPeriod.currentPeriodEnd,
          current_period_start: billingPeriod.currentPeriodStart,
          current_period_end: billingPeriod.currentPeriodEnd,
          next_billing_at: billingPeriod.nextBillingAt,
          billing_anchor_day: billingPeriod.billingAnchorDay,
        })
        .select('id')
        .single();

      if (subscriptionInsertResult.error) {
        console.error(subscriptionInsertResult.error);

        return Response.json({ error: '요금제 구독을 저장하지 못했습니다.' }, { status: 500 });
      }

      const siteOpenResult = await supabaseAdmin
        .from('rhizomes')
        .update({
          is_shutdown: false,
        })
        .eq('id', site.id);

      if (siteOpenResult.error) {
        console.error(siteOpenResult.error);

        return Response.json({ error: '사이트를 오픈하지 못했습니다.' }, { status: 500 });
      }

      return Response.json({
        mode: 'trial_started',
        ok: true,
        subscriptionId: subscriptionInsertResult.data.id,
      });
    }

    const paymentKey = createPortOnePaymentKey(orderNo);

    await requestPortOneBillingPayment({
      paymentId: paymentKey,
      billingKey: billingMethod.billing_key,
      customerId: billingMethod.customer_key,
      amount: plan.price,
      orderName,
    });

    const paymentResponse = await getPortOnePayment(paymentKey);
    const payment = getPortOnePaymentFromResponse(paymentResponse);

    assertPortOnePaidPayment(payment);

    const billingAnchorDay = getBillingAnchorDay(now);
    const billingPeriod = createNextMonthlyBillingPeriod({
      currentPeriodEnd: now,
      billingAnchorDay,
    });

    const paymentInsertResult = await supabaseAdmin
      .from('payments')
      .insert({
        provider: getCurrentPortOneProvider(),
        payment_key: paymentKey,
        order_no: orderNo,
        tx_no: null,
        transaction_no: getPortOnePaymentTransactionNo(payment),
        buyer_user_id: session.authUserId,
        amount: plan.price,
        refunded_amount: 0,
        currency: 'KRW',
        status: PAYMENT_STATUS.PAID,
        payment_method: PAYMENT_METHOD.CARD,
        payment_type: PAYMENT_TYPE.PLAN_BILLING,
        target_type: PAYMENT_TARGET_TYPE.PLAN,
        target_id: site.id,
        post_payment: null,
        subscription_id: null,
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

      return Response.json({ error: '요금제 결제 내역을 저장하지 못했습니다.' }, { status: 500 });
    }

    const subscriptionInsertResult = await supabaseAdmin
      .from('subscriptions')
      .insert({
        subscriber_user_id: session.authUserId,
        subscription_type: SUBSCRIPTION_TYPE.PLAN_BILLING,
        target_type: PAYMENT_TARGET_TYPE.PLAN,
        target_id: site.id,
        owner_user_id: null,
        price: getPortOnePaidAmount(payment) || plan.price,
        status: SUBSCRIPTION_STATUS.ACTIVE,
        billing_key: encrypt(billingMethod.billing_key),
        customer_key: billingMethod.customer_key,
        last_payment_id: paymentInsertResult.data.id,
        trial_started_at: null,
        trial_ends_at: null,
        current_period_start: billingPeriod.currentPeriodStart,
        current_period_end: billingPeriod.currentPeriodEnd,
        next_billing_at: billingPeriod.nextBillingAt,
        billing_anchor_day: billingAnchorDay,
      })
      .select('id')
      .single();

    if (subscriptionInsertResult.error) {
      console.error(subscriptionInsertResult.error);

      return Response.json({ error: '요금제 구독을 저장하지 못했습니다.' }, { status: 500 });
    }

    const paymentUpdateResult = await supabaseAdmin
      .from('payments')
      .update({ subscription_id: subscriptionInsertResult.data.id })
      .eq('id', paymentInsertResult.data.id);

    if (paymentUpdateResult.error) {
      console.error(paymentUpdateResult.error);

      return Response.json({ error: '결제 구독 정보를 갱신하지 못했습니다.' }, { status: 500 });
    }

    const siteOpenResult = await supabaseAdmin
      .from('rhizomes')
      .update({
        is_shutdown: false,
      })
      .eq('id', site.id);

    if (siteOpenResult.error) {
      console.error(siteOpenResult.error);

      return Response.json({ error: '사이트를 오픈하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      mode: 'direct_billing',
      ok: true,
      subscriptionId: subscriptionInsertResult.data.id,
      paymentId: paymentInsertResult.data.id,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '결제수단 등록을 시작하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '결제수단 등록을 시작하지 못했습니다.' }, { status: 500 });
  }
}
