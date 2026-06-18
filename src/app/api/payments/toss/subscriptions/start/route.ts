import crypto from 'crypto';
import { encrypt } from '@/lib/encryption/encrypt';
import { createMonthlyBillingPeriod } from '@/lib/payments/billingPeriod';
import { getTossClientKey, requestTossBillingPayment } from '@/lib/payments/toss';
import {
  PAYMENT_METHOD,
  PAYMENT_TARGET_TYPE,
  PAYMENT_TYPE,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TYPE,
} from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { createPaymentOrderNo } from '@/lib/payments/orderNo';

type SubscriptionTargetType = 'board' | 'series';

type SubscriptionStartBody = {
  siteName?: string;
  boardName?: string;
  targetType?: string;
  seriesName?: string | null;
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

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string | null;
  is_subscription: boolean | null;
};

type SeriesRow = {
  id: string;
  series_key: string;
  series_label: string | null;
  is_subscription: boolean | null;
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

function getTargetType(value: string): SubscriptionTargetType | null {
  if (value === 'board' || value === 'series') {
    return value;
  }

  return null;
}

function getSubscriptionType(targetType: SubscriptionTargetType) {
  if (targetType === 'board') {
    return SUBSCRIPTION_TYPE.BOARD_SUBSCRIPTION;
  }

  return SUBSCRIPTION_TYPE.SERIES_SUBSCRIPTION;
}

function getPaymentType(targetType: SubscriptionTargetType) {
  if (targetType === 'board') {
    return PAYMENT_TYPE.BOARD_SUBSCRIPTION;
  }

  return PAYMENT_TYPE.SERIES_SUBSCRIPTION;
}

function getPaymentTargetType(targetType: SubscriptionTargetType) {
  if (targetType === 'board') {
    return PAYMENT_TARGET_TYPE.BOARD;
  }

  return PAYMENT_TARGET_TYPE.SERIES;
}

function getSettingSubscriptionType(targetType: SubscriptionTargetType) {
  if (targetType === 'board') {
    return 'board_subscription';
  }

  return 'series_subscription';
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

async function getSubscriptionTarget({
  supabaseAdmin,
  siteId,
  boardName,
  targetType,
  seriesName,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  siteId: string;
  boardName: string;
  targetType: SubscriptionTargetType;
  seriesName: string;
}) {
  const boardResult = await supabaseAdmin
    .from('boards')
    .select('id, board_key, board_label, is_subscription')
    .eq('site_id', siteId)
    .eq('board_key', boardName)
    .maybeSingle();

  if (boardResult.error) {
    throw new Error('게시판 정보를 확인하지 못했습니다.');
  }

  if (!boardResult.data) {
    throw new Error('게시판 정보를 찾을 수 없습니다.');
  }

  const board = boardResult.data as BoardRow;

  if (targetType === 'board') {
    return {
      targetId: board.id,
      targetLabel: board.board_label,
      isSubscriptionTarget: Boolean(board.is_subscription),
    };
  }

  if (!seriesName) {
    throw new Error('seriesName이 유효하지 않습니다.');
  }

  const seriesResult = await supabaseAdmin
    .from('board_series')
    .select('id, series_key, series_label, is_subscription')
    .eq('site_id', siteId)
    .eq('board_id', board.id)
    .eq('series_key', seriesName)
    .maybeSingle();

  if (seriesResult.error) {
    throw new Error('연재 정보를 확인하지 못했습니다.');
  }

  if (!seriesResult.data) {
    throw new Error('연재 정보를 찾을 수 없습니다.');
  }

  const series = seriesResult.data as SeriesRow;

  return {
    targetId: series.id,
    targetLabel: series.series_label,
    isSubscriptionTarget: Boolean(series.is_subscription),
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SubscriptionStartBody;
    const siteName = normalizeText(body.siteName).toLowerCase();
    const boardName = normalizeText(body.boardName).toLowerCase();
    const targetType = getTargetType(normalizeText(body.targetType));
    const seriesName = normalizeText(body.seriesName).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!boardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!targetType) {
      return Response.json({ error: 'targetType이 유효하지 않습니다.' }, { status: 400 });
    }

    const successUrl = getSafeRedirectUrl(request, body.successUrl);
    const failUrl = getSafeRedirectUrl(request, body.failUrl);
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

    const subscriptionTarget = await getSubscriptionTarget({
      supabaseAdmin,
      siteId: site.id,
      boardName,
      targetType,
      seriesName,
    });

    if (!subscriptionTarget.isSubscriptionTarget) {
      return Response.json({ error: '구독 대상이 아닙니다.' }, { status: 400 });
    }

    const settingResult = await supabaseAdmin
      .from('subscription_settings')
      .select('price, is_enabled')
      .eq('target_type', targetType)
      .eq('target_id', subscriptionTarget.targetId)
      .eq('subscription_type', getSettingSubscriptionType(targetType))
      .maybeSingle();

    if (settingResult.error) {
      console.error(settingResult.error);

      return Response.json({ error: '구독 설정을 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!settingResult.data) {
      return Response.json({ error: '구독 설정을 찾을 수 없습니다.' }, { status: 404 });
    }

    const setting = settingResult.data as SubscriptionSettingRow;

    if (!setting.is_enabled) {
      return Response.json({ error: '구독이 활성화되어 있지 않습니다.' }, { status: 400 });
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
    const subscriptionType = getSubscriptionType(targetType);
    const paymentType = getPaymentType(targetType);
    const paymentTargetType = getPaymentTargetType(targetType);

    const existingActiveSubscriptionResult = await supabaseAdmin
      .from('subscriptions')
      .select('id, status, canceled_at, expired_at')
      .eq('subscriber_user_id', session.authUserId)
      .eq('subscription_type', subscriptionType)
      .eq('target_type', paymentTargetType)
      .eq('target_id', subscriptionTarget.targetId)
      .in('status', ['trialing', 'active', 'past_due'])
      .is('canceled_at', null)
      .is('expired_at', null)
      .maybeSingle();

    if (existingActiveSubscriptionResult.error) {
      console.error(existingActiveSubscriptionResult.error);

      return Response.json({ error: '기존 구독 상태를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (existingActiveSubscriptionResult.data) {
      return Response.json({ error: '이미 구독 중입니다.' }, { status: 400 });
    }

    const customerKey = createCustomerKey(session.authUserId);
    const orderNo = createOrderNo();
    const orderName =
      normalizeText(body.orderName) ||
      `${subscriptionTarget.targetLabel ?? (targetType === 'series' ? '연재' : '게시판')} 구독`;

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
      successUrl.searchParams.set('boardName', boardName);
      successUrl.searchParams.set('targetType', targetType);
      successUrl.searchParams.set('orderNo', orderNo);
      successUrl.searchParams.set('customerKey', customerKey);

      failUrl.searchParams.set('siteName', siteName);
      failUrl.searchParams.set('boardName', boardName);
      failUrl.searchParams.set('targetType', targetType);
      failUrl.searchParams.set('orderNo', orderNo);
      failUrl.searchParams.set('paymentType', paymentType);

      if (targetType === 'series') {
        successUrl.searchParams.set('seriesName', seriesName);
        failUrl.searchParams.set('seriesName', seriesName);
      }

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
        payment_method: PAYMENT_METHOD.CARD,
        payment_type: paymentType,
        target_type: paymentTargetType,
        target_id: subscriptionTarget.targetId,
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
        subscription_type: subscriptionType,
        target_type: paymentTargetType,
        target_id: subscriptionTarget.targetId,
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

      return Response.json({ error: '구독 정보를 저장하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      mode: 'direct_billing',
      ok: true,
      subscriptionId: subscriptionInsertResult.data.id,
      paymentId: paymentInsertResult.data.id,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '구독을 시작하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '구독을 시작하지 못했습니다.' }, { status: 500 });
  }
}
