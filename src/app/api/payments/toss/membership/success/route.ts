import { encrypt } from '@/lib/encryption/encrypt';
import { createNextMonthlyBillingPeriod, getBillingAnchorDay } from '@/lib/payments/billingPeriod';
import { getPaymentPolicyMs } from '@/lib/payments/refunds';
import { createOwnerPaymentSplits } from '@/lib/payments/splits';
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

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type MembershipSuccessBody = {
  authKey?: string;
  customerKey?: string;
  siteName?: string;
  orderNo?: string;
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

async function getSiteOwnerUserId({ supabaseAdmin, ownerId }: { supabaseAdmin: SupabaseAdminClient; ownerId: string }) {
  const ownerStigmaResult = await supabaseAdmin.from('stigmas').select('id, user_id').eq('id', ownerId).maybeSingle();

  if (ownerStigmaResult.error) {
    throw new Error('사이트 오너 정보를 확인하지 못했습니다.');
  }

  if (!ownerStigmaResult.data) {
    throw new Error('사이트 오너 정보를 찾을 수 없습니다.');
  }

  const ownerStigma = ownerStigmaResult.data as OwnerStigmaRow;

  return ownerStigma.user_id;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MembershipSuccessBody;
    const authKey = normalizeText(body.authKey);
    const customerKey = normalizeText(body.customerKey);
    const siteName = normalizeText(body.siteName).toLowerCase();
    const orderNo = normalizeText(body.orderNo);

    if (!authKey) {
      return Response.json({ error: 'authKey가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!customerKey) {
      return Response.json({ error: 'customerKey가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!orderNo) {
      return Response.json({ error: 'orderNo가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!orderNo.startsWith('VH-MBS-')) {
      return Response.json({ error: '멤버십 주문번호가 올바르지 않습니다.' }, { status: 400 });
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
      .eq('subscription_type', SUBSCRIPTION_TYPE.BLOG_MEMBERSHIP)
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

    const siteOwnerUserId = await getSiteOwnerUserId({
      supabaseAdmin,
      ownerId: site.owner_id,
    });

    const latestSubscriptionResult = await supabaseAdmin
      .from('subscriptions')
      .select('id, status, current_period_end, next_billing_at, canceled_at, expired_at')
      .eq('subscriber_user_id', session.authUserId)
      .eq('subscription_type', SUBSCRIPTION_TYPE.BLOG_MEMBERSHIP)
      .eq('target_type', PAYMENT_TARGET_TYPE.BLOG)
      .eq('target_id', site.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestSubscriptionResult.error) {
      console.error(latestSubscriptionResult.error);

      return Response.json({ error: '기존 멤버십 상태를 확인하지 못했습니다.' }, { status: 500 });
    }

    const latestSubscription = (latestSubscriptionResult.data as SubscriptionRow | null) ?? null;
    const now = new Date();
    const nowText = now.toISOString();

    if (isOpenSubscription(latestSubscription)) {
      return Response.json({ error: '이미 멤버십 구독 중입니다.' }, { status: 400 });
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
          updated_at: nowText,
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

    if (isScheduledCancelSubscription(latestSubscription, now)) {
      const scheduledCancelSubscription = latestSubscription;

      if (!scheduledCancelSubscription) {
        return Response.json({ error: '취소 예약된 멤버십을 찾을 수 없습니다.' }, { status: 404 });
      }

      const subscriptionUpdateResult = await supabaseAdmin
        .from('subscriptions')
        .update({
          canceled_at: null,
          next_billing_at: scheduledCancelSubscription.current_period_end,
          updated_at: nowText,
        })
        .eq('id', scheduledCancelSubscription.id);

      if (subscriptionUpdateResult.error) {
        console.error(subscriptionUpdateResult.error);

        return Response.json({ error: '멤버십 취소를 철회하지 못했습니다.' }, { status: 500 });
      }

      return Response.json({
        mode: 'resume_scheduled_cancel',
        ok: true,
        subscriptionId: scheduledCancelSubscription.id,
        nextBillingAt: scheduledCancelSubscription.current_period_end,
      });
    }

    const tossPaymentResult = (await requestTossBillingPayment({
      billingKey: billingKeyResult.billingKey,
      customerKey,
      amount: setting.price,
      orderId: orderNo,
      orderName: '데브허브 블로그 멤버십',
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
        amount: setting.price,
        refunded_amount: 0,
        currency: 'KRW',
        status: PAYMENT_STATUS.PAID,
        payment_method: PAYMENT_METHOD.CARD,
        payment_type: PAYMENT_TYPE.BLOG_MEMBERSHIP,
        target_type: PAYMENT_TARGET_TYPE.BLOG,
        target_id: site.id,
        post_payment: null,
        subscription_id: null,
        failure_code: null,
        failure_message: null,
        failure_stage: null,
        refund_policy: REFUND_POLICY.SEVEN_DAYS,
        refundable_until: createRefundableUntil(now),
        raw_data: tossPaymentResult,
        approved_at: tossPaymentResult.approvedAt,
        refunded_at: null,
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
        owner_user_id: siteOwnerUserId,
        price: setting.price,
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

      return Response.json({ error: '멤버십 정보를 저장하지 못했습니다.' }, { status: 500 });
    }

    const paymentUpdateResult = await supabaseAdmin
      .from('payments')
      .update({
        subscription_id: subscriptionInsertResult.data.id,
      })
      .eq('id', paymentInsertResult.data.id);

    if (paymentUpdateResult.error) {
      console.error(paymentUpdateResult.error);

      return Response.json({ error: '결제 구독 정보를 갱신하지 못했습니다.' }, { status: 500 });
    }

    await createOwnerPaymentSplits({
      supabaseAdmin,
      paymentId: paymentInsertResult.data.id,
      siteId: site.id,
      siteOwnerUserId,
      amount: setting.price,
    });

    return Response.json({
      ok: true,
      mode: 'direct_billing',
      subscriptionId: subscriptionInsertResult.data.id,
      paymentId: paymentInsertResult.data.id,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '멤버십 구독을 완료하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '멤버십 구독을 완료하지 못했습니다.' }, { status: 500 });
  }
}
