import { NextRequest } from 'next/server';
import { encrypt } from '@/lib/encryption/encrypt';
import {
  createMonthlyBillingPeriod,
  createNextMonthlyBillingPeriod,
  getBillingAnchorDay,
} from '@/lib/payments/billingPeriod';
import { getPaymentPolicyMs } from '@/lib/payments/refunds';
import { issueTossBillingKey, requestTossBillingPayment } from '@/lib/payments/toss';
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
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type PlanBillingSuccessBody = {
  authKey?: string;
  customerKey?: string;
  siteId?: string;
  orderNo?: string;
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

type SubscriptionRow = {
  id: string;
  status: string;
  current_period_end: string | null;
  next_billing_at: string | null;
  canceled_at: string | null;
  expired_at: string | null;
};

type TossBillingKeyResult = {
  mId: string;
  customerKey: string;
  authenticatedAt: string;
  method: string;
  billingKey: string;
  card?: {
    issuerCode?: string;
    acquirerCode?: string;
    number?: string;
    cardType?: string;
    ownerType?: string;
  };
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

type BillingMethodRow = {
  id: string;
  is_default: boolean;
};

const CARD_COMPANY_BY_CODE: Record<string, string> = {
  '3K': '기업BC',
  '46': '광주은행',
  '71': '롯데카드',
  '30': 'KDB산업은행',
  '31': 'BC카드',
  '51': '삼성카드',
  '38': '새마을금고',
  '41': '신한카드',
  '62': '신협',
  '36': '씨티카드',
  '33': '우리카드',
  '37': '우체국',
  '39': '저축은행',
  '35': '전북은행',
  '42': '제주은행',
  '15': '카카오뱅크',
  '3A': '케이뱅크',
  '24': '토스뱅크',
  '21': '하나카드',
  '61': '현대카드',
  '11': 'KB국민카드',
  '91': 'NH농협카드',
  '34': '수협은행',
};

function getCardCompanyName(cardCompanyCode: string) {
  return CARD_COMPANY_BY_CODE[cardCompanyCode] ?? '알 수 없음';
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
    const body = (await request.json()) as PlanBillingSuccessBody;
    const authKey = normalizeText(body.authKey);
    const customerKey = normalizeText(body.customerKey);
    const siteId = normalizeText(body.siteId);
    const orderNo = normalizeText(body.orderNo);
    const purpose = body.purpose === 'billing_method' ? 'billing_method' : 'plan_subscription';

    if (!authKey) {
      return Response.json({ error: 'authKey가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!customerKey) {
      return Response.json({ error: 'customerKey가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!siteId) {
      return Response.json({ error: 'siteId가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!orderNo) {
      return Response.json({ error: 'orderNo가 유효하지 않습니다.' }, { status: 400 });
    }

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

    if (purpose !== 'billing_method' && isOpenSubscription(latestSubscription)) {
      return Response.json({ error: '이미 요금제 구독이 등록되어 있습니다.' }, { status: 400 });
    }

    const billingKeyResult = (await issueTossBillingKey({
      authKey,
      customerKey,
    })) as TossBillingKeyResult;

    const cardCompanyCode = normalizeText(billingKeyResult.card?.issuerCode);
    const cardCompany = getCardCompanyName(cardCompanyCode);
    const cardNumberMasked = normalizeText(billingKeyResult.card?.number);
    const cardOwnerType = normalizeText(billingKeyResult.card?.ownerType);
    const cardType = normalizeText(billingKeyResult.card?.cardType);

    if (!cardCompanyCode || !cardNumberMasked || !cardOwnerType || !cardType) {
      return Response.json({ error: '카드 정보를 확인하지 못했습니다.' }, { status: 400 });
    }

    const existingDefaultBillingMethodResult = await supabaseAdmin
      .from('subscription_billing_methods')
      .select('id, is_default')
      .eq('user_id', session.authUserId)
      .eq('provider', PAYMENT_PROVIDER.TOSS)
      .eq('is_default', true)
      .maybeSingle();

    if (existingDefaultBillingMethodResult.error) {
      console.error(existingDefaultBillingMethodResult.error);

      return Response.json({ error: '기본 결제수단을 확인하지 못했습니다.' }, { status: 500 });
    }

    const existingBillingMethodResult = await supabaseAdmin
      .from('subscription_billing_methods')
      .select('id, is_default')
      .eq('user_id', session.authUserId)
      .eq('provider', PAYMENT_PROVIDER.TOSS)
      .eq('billing_key', billingKeyResult.billingKey)
      .maybeSingle();

    if (existingBillingMethodResult.error) {
      console.error(existingBillingMethodResult.error);

      return Response.json({ error: '등록된 결제수단을 확인하지 못했습니다.' }, { status: 500 });
    }

    const existingBillingMethod = existingBillingMethodResult.data as BillingMethodRow | null;

    if (existingBillingMethod) {
      const billingMethodUpdateResult = await supabaseAdmin
        .from('subscription_billing_methods')
        .update({
          customer_key: customerKey,
          card_company: cardCompany,
          card_company_code: cardCompanyCode,
          card_number_masked: cardNumberMasked,
          owner_type: cardOwnerType,
          card_type: cardType,
          is_default: existingDefaultBillingMethodResult.data ? existingBillingMethod.is_default : true,
          updated_at: now.toISOString(),
        })
        .eq('id', existingBillingMethod.id);

      if (billingMethodUpdateResult.error) {
        console.error(billingMethodUpdateResult.error);

        return Response.json({ error: '결제수단을 갱신하지 못했습니다.' }, { status: 500 });
      }
    } else {
      const billingMethodInsertResult = await supabaseAdmin
        .from('subscription_billing_methods')
        .insert({
          user_id: session.authUserId,
          provider: PAYMENT_PROVIDER.TOSS,
          customer_key: customerKey,
          billing_key: billingKeyResult.billingKey,
          card_company: cardCompany,
          card_company_code: cardCompanyCode,
          card_number_masked: cardNumberMasked,
          owner_type: cardOwnerType,
          card_type: cardType,
          is_default: !existingDefaultBillingMethodResult.data,
        })
        .select('id')
        .single();

      if (billingMethodInsertResult.error) {
        console.error(billingMethodInsertResult.error);

        return Response.json({ error: '결제수단을 저장하지 못했습니다.' }, { status: 500 });
      }
    }

    if (purpose === 'billing_method') {
      return Response.json({ ok: true });
    }

    const scheduledCancelSubscription = isScheduledCancelSubscription(latestSubscription, now)
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
        ok: true,
        mode: 'resume_scheduled_cancel',
        subscriptionId: scheduledCancelSubscription.id,
        nextBillingAt: scheduledCancelSubscription.current_period_end,
      });
    }

    const shouldUseTrial = !latestSubscription;

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
          billing_key: encrypt(billingKeyResult.billingKey),
          customer_key: customerKey,
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
        ok: true,
        mode: 'trial_started',
        subscriptionId: subscriptionInsertResult.data.id,
      });
    }

    const tossPaymentResult = (await requestTossBillingPayment({
      billingKey: billingKeyResult.billingKey,
      customerKey,
      amount: plan.price,
      orderId: orderNo,
      orderName: plan.plan_label || '데브허브 사이트 요금제',
    })) as TossBillingPaymentResult;

    const billingAnchorDay = getBillingAnchorDay(now);
    const billingPeriod = createNextMonthlyBillingPeriod({
      currentPeriodEnd: now,
      billingAnchorDay,
    });

    const paymentInsertResult = await supabaseAdmin
      .from('payments')
      .insert({
        provider: PAYMENT_PROVIDER.TOSS,
        payment_key: tossPaymentResult.paymentKey,
        order_no: orderNo,
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
        approved_at: tossPaymentResult.approvedAt,
        refunded_at: null,
        raw_data: tossPaymentResult,
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
        price: plan.price,
        status: SUBSCRIPTION_STATUS.ACTIVE,
        billing_key: encrypt(billingKeyResult.billingKey),
        customer_key: customerKey,
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
      ok: true,
      mode: 'direct_billing',
      subscriptionId: subscriptionInsertResult.data.id,
      paymentId: paymentInsertResult.data.id,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '결제수단 등록을 완료하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '결제수단 등록을 완료하지 못했습니다.' }, { status: 500 });
  }
}
