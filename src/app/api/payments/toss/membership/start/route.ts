import crypto from 'crypto';
import { encrypt } from '@/lib/encryption/encrypt';
import { createMonthlyBillingPeriod } from '@/lib/payments/billingPeriod';
import { getTossClientKey, requestTossBillingPayment } from '@/lib/payments/toss';
import { PAYMENT_TARGET_TYPE, PAYMENT_TYPE, SUBSCRIPTION_STATUS, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { createPaymentOrderNo } from '@/lib/payments/orderNo';

type MembershipStartBody = {
  siteName?: string;
  orderName?: string;
  successUrl?: string;
  failUrl?: string;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  owner_id: string;
};

type OwnerStigmaRow = {
  id: string;
  user_id: string;
};

type SubscriptionSettingRow = {
  price: number;
  is_enabled: boolean;
};

type BillingMethodRow = {
  id: string;
  customer_key: string;
  billing_key: string;
};

type TossBillingPaymentResult = {
  paymentKey: string;
  orderId: string;
  orderName: string;
  method: string;
  totalAmount: number;
  status: string;
  approvedAt: string;
};

function createCustomerKey(authUserId: string) {
  const customerKeyHash = crypto.createHash('sha256').update(authUserId).digest('hex');

  return `user_${customerKeyHash}`;
}

function createOrderNo() {
  return createPaymentOrderNo('SITE_DONATION');
}

function getSafeRedirectUrl(request: Request, url: string | undefined) {
  if (!url) {
    throw new Error('이동할 주소가 없습니다.');
  }

  const requestUrl = new URL(request.url);
  const parsedUrl = new URL(url, requestUrl.origin);

  if (parsedUrl.origin !== requestUrl.origin) {
    throw new Error('이동할 주소가 올바르지 않습니다.');
  }

  return parsedUrl;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MembershipStartBody;
    const siteName = normalizeText(body.siteName).toLowerCase();
    const orderName = normalizeText(body.orderName) || '데브허브 블로그 멤버십';
    const successUrl = getSafeRedirectUrl(request, body.successUrl);
    const failUrl = getSafeRedirectUrl(request, body.failUrl);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const siteResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label, owner_id')
      .eq('site_key', siteName)
      .maybeSingle();

    if (siteResult.error) {
      console.error(siteResult.error);

      return Response.json({ error: '사이트 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!siteResult.data) {
      return Response.json({ error: '사이트 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const site = siteResult.data as SiteRow;
    const session = await verifySession({ siteId: site.id });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const settingResult = await supabaseAdmin
      .from('subscription_settings')
      .select('price, is_enabled')
      .eq('target_type', PAYMENT_TARGET_TYPE.BLOG)
      .eq('target_id', site.id)
      .eq('subscription_type', 'blog_membership')
      .maybeSingle();

    if (settingResult.error) {
      console.error(settingResult.error);

      return Response.json({ error: '멤버십 설정을 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!settingResult.data) {
      return Response.json({ error: '멤버십 설정을 찾을 수 없습니다.' }, { status: 404 });
    }

    const setting = settingResult.data as SubscriptionSettingRow;

    if (!setting.is_enabled) {
      return Response.json({ error: '멤버십이 활성화되어 있지 않습니다.' }, { status: 400 });
    }

    const ownerStigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id, user_id')
      .eq('id', site.owner_id)
      .maybeSingle();

    if (ownerStigmaResult.error) {
      console.error(ownerStigmaResult.error);

      return Response.json({ error: '사이트 오너 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!ownerStigmaResult.data) {
      return Response.json({ error: '사이트 오너 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const ownerStigma = ownerStigmaResult.data as OwnerStigmaRow;

    const existingActiveSubscriptionResult = await supabaseAdmin
      .from('subscriptions')
      .select('id, status, canceled_at, expired_at')
      .eq('subscriber_user_id', session.authUserId)
      .eq('subscription_type', SUBSCRIPTION_TYPE.BLOG_MEMBERSHIP)
      .eq('target_type', PAYMENT_TARGET_TYPE.BLOG)
      .eq('target_id', site.id)
      .in('status', ['trialing', 'active', 'past_due'])
      .is('canceled_at', null)
      .is('expired_at', null)
      .maybeSingle();

    if (existingActiveSubscriptionResult.error) {
      console.error(existingActiveSubscriptionResult.error);

      return Response.json({ error: '기존 멤버십 상태를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (existingActiveSubscriptionResult.data) {
      return Response.json({ error: '이미 멤버십 구독 중입니다.' }, { status: 400 });
    }

    const customerKey = createCustomerKey(session.authUserId);
    const orderNo = createPaymentOrderNo('BLOG_MEMBERSHIP');

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
      successUrl.searchParams.set('siteName', siteName);
      successUrl.searchParams.set('orderNo', orderNo);
      successUrl.searchParams.set('customerKey', customerKey);

      failUrl.searchParams.set('siteName', siteName);
      failUrl.searchParams.set('orderNo', orderNo);
      failUrl.searchParams.set('paymentType', PAYMENT_TYPE.BLOG_MEMBERSHIP);

      return Response.json({
        mode: 'billing_auth',
        clientKey: getTossClientKey(),
        customerKey,
        orderNo,
        orderName,
        amount: setting.price,
        successUrl: successUrl.toString(),
        failUrl: failUrl.toString(),
      });
    }

    const tossPaymentResult = (await requestTossBillingPayment({
      billingKey: billingMethod.billing_key,
      customerKey: billingMethod.customer_key,
      amount: setting.price,
      orderId: orderNo,
      orderName,
    })) as TossBillingPaymentResult;

    const now = new Date();
    const billingPeriod = createMonthlyBillingPeriod({
      startedAt: now,
    });

    const paymentInsertResult = await supabaseAdmin
      .from('payments')
      .insert({
        provider: 'toss',
        payment_key: tossPaymentResult.paymentKey,
        order_no: orderNo,
        buyer_user_id: session.authUserId,
        amount: setting.price,
        refunded_amount: 0,
        currency: 'KRW',
        status: 'paid',
        payment_method: tossPaymentResult.method,
        payment_type: PAYMENT_TYPE.BLOG_MEMBERSHIP,
        target_type: PAYMENT_TARGET_TYPE.BLOG,
        target_id: site.id,
        refund_policy: 'seven_days',
        raw_data: tossPaymentResult,
        approved_at: tossPaymentResult.approvedAt,
      })
      .select('id')
      .single();

    if (paymentInsertResult.error) {
      console.error(paymentInsertResult.error);

      return Response.json({ error: '결제 정보를 저장하지 못했습니다.' }, { status: 500 });
    }

    const subscriptionInsertResult = await supabaseAdmin
      .from('subscriptions')
      .insert({
        subscriber_user_id: session.authUserId,
        subscription_type: SUBSCRIPTION_TYPE.BLOG_MEMBERSHIP,
        target_type: PAYMENT_TARGET_TYPE.BLOG,
        target_id: site.id,
        owner_user_id: ownerStigma.user_id,
        price: setting.price,
        status: SUBSCRIPTION_STATUS.ACTIVE,
        billing_key: encrypt(billingMethod.billing_key),
        customer_key: billingMethod.customer_key,
        last_payment_id: paymentInsertResult.data.id,
        trial_started_at: null,
        trial_ends_at: null,
        current_period_start: billingPeriod.currentPeriodStart,
        current_period_end: billingPeriod.currentPeriodEnd,
        next_billing_at: billingPeriod.nextBillingAt,
        billing_anchor_day: billingPeriod.billingAnchorDay,
      })
      .select('id')
      .single();

    if (subscriptionInsertResult.error) {
      console.error(subscriptionInsertResult.error);

      return Response.json({ error: '멤버십 정보를 저장하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      mode: 'direct_billing',
      ok: true,
      subscriptionId: subscriptionInsertResult.data.id,
      paymentId: paymentInsertResult.data.id,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '멤버십 구독을 시작하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '멤버십 구독을 시작하지 못했습니다.' }, { status: 500 });
  }
}
