import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { encrypt } from '@/lib/encryption/encrypt';
import { createMonthlyBillingPeriod } from '@/lib/payments/billingPeriod';
import { getTossClientKey } from '@/lib/payments/toss';
import { PAYMENT_TARGET_TYPE, PAYMENT_TYPE, SUBSCRIPTION_STATUS, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { createPaymentOrderNo } from '@/lib/payments/orderNo';

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

function createCustomerKey(authUserId: string) {
  const customerKeyHash = crypto.createHash('sha256').update(authUserId).digest('hex');

  return `user_${customerKeyHash}`;
}

function createOrderNo() {
  return createPaymentOrderNo('PLAN');
}

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

    const existingActiveSubscriptionResult = await supabaseAdmin
      .from('subscriptions')
      .select('id, status, canceled_at, expired_at')
      .eq('subscriber_user_id', session.authUserId)
      .eq('subscription_type', SUBSCRIPTION_TYPE.PLAN_BILLING)
      .eq('target_type', PAYMENT_TARGET_TYPE.PLAN)
      .eq('target_id', site.id)
      .in('status', ['trialing', 'active', 'past_due'])
      .is('canceled_at', null)
      .is('expired_at', null)
      .maybeSingle();

    if (existingActiveSubscriptionResult.error) {
      console.error(existingActiveSubscriptionResult.error);

      return Response.json({ error: '기존 요금제 구독 상태를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (existingActiveSubscriptionResult.data && purpose !== 'billing_method') {
      return Response.json({ error: '이미 요금제 구독이 등록되어 있습니다.' }, { status: 400 });
    }

    const customerKey = createCustomerKey(session.authUserId);
    const orderNo = createOrderNo();

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
        clientKey: getTossClientKey(),
        customerKey,
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
      .eq('provider', 'toss')
      .eq('is_default', true)
      .limit(1);

    if (billingMethodResult.error) {
      console.error(billingMethodResult.error);

      return Response.json({ error: '등록된 결제수단을 확인하지 못했습니다.' }, { status: 500 });
    }

    const billingMethods = (billingMethodResult.data ?? []) as unknown as BillingMethodRow[];
    const billingMethod = billingMethods[0] ?? null;

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
        clientKey: getTossClientKey(),
        customerKey,
        orderNo,
        orderName,
        successUrl: successUrl.toString(),
        failUrl: failUrl.toString(),
      });
    }

    const now = new Date();
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
      mode: 'direct_billing',
      ok: true,
      subscriptionId: subscriptionInsertResult.data.id,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '결제수단 등록을 시작하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '결제수단 등록을 시작하지 못했습니다.' }, { status: 500 });
  }
}
