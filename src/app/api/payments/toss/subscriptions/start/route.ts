import crypto from 'crypto';
import { encrypt } from '@/lib/encryption/encrypt';
import { createNextMonthlyBillingPeriod, getBillingAnchorDay } from '@/lib/payments/billingPeriod';
import { createPaymentOrderNo } from '@/lib/payments/orderNo';
import { createOwnerPaymentSplits } from '@/lib/payments/splits';
import { getTossClientKey, requestTossBillingPayment } from '@/lib/payments/toss';
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

type SubscriptionTarget = {
  targetId: string;
  targetLabel: string | null;
  boardId: string;
  seriesId: string | null;
  isSubscriptionTarget: boolean;
};

function createCustomerKey(authUserId: string) {
  const customerKeyHash = crypto.createHash('sha256').update(authUserId).digest('hex');

  return `user_${customerKeyHash}`;
}

function createSubscriptionOrderNo(targetType: SubscriptionTargetType) {
  if (targetType === 'board') {
    return createPaymentOrderNo('BOARD_SUBSCRIPTION');
  }

  return createPaymentOrderNo('SERIES_SUBSCRIPTION');
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

function getRefundableUntil(startedAt: Date) {
  const refundableUntil = new Date(startedAt);

  refundableUntil.setDate(refundableUntil.getDate() + 7);

  return refundableUntil;
}

async function getSiteByName({ supabaseAdmin, siteName }: { supabaseAdmin: SupabaseAdminClient; siteName: string }) {
  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_label, owner_id')
    .eq('site_key', siteName)
    .maybeSingle();

  if (siteResult.error) {
    throw new Error('사이트 정보를 확인하지 못했습니다.');
  }

  if (!siteResult.data) {
    throw new Error('사이트 정보를 찾을 수 없습니다.');
  }

  return siteResult.data as SiteRow;
}

async function getSubscriptionEnabledSeriesCount({
  supabaseAdmin,
  siteId,
  boardId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  boardId: string;
}) {
  const seriesCountResult = await supabaseAdmin
    .from('board_series')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .eq('is_subscription', true);

  if (seriesCountResult.error) {
    throw new Error('구독 연재 개수를 확인하지 못했습니다.');
  }

  return seriesCountResult.count ?? 0;
}

async function getSubscriptionTarget({
  supabaseAdmin,
  siteId,
  boardName,
  targetType,
  seriesName,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  boardName: string;
  targetType: SubscriptionTargetType;
  seriesName: string;
}): Promise<SubscriptionTarget> {
  const boardResult = await supabaseAdmin
    .from('boards')
    .select('id, board_key, board_label')
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

  if (targetType === PAYMENT_TARGET_TYPE.BOARD) {
    const subscriptionEnabledSeriesCount = await getSubscriptionEnabledSeriesCount({
      supabaseAdmin,
      siteId,
      boardId: board.id,
    });

    return {
      targetId: board.id,
      targetLabel: board.board_label,
      boardId: board.id,
      seriesId: null,
      isSubscriptionTarget: subscriptionEnabledSeriesCount >= 2,
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
    boardId: board.id,
    seriesId: series.id,
    isSubscriptionTarget: series.is_subscription === true,
  };
}

async function getSubscriptionSetting({
  supabaseAdmin,
  paymentTargetType,
  targetId,
  subscriptionType,
}: {
  supabaseAdmin: SupabaseAdminClient;
  paymentTargetType: string;
  targetId: string;
  subscriptionType: string;
}) {
  const settingResult = await supabaseAdmin
    .from('subscription_settings')
    .select('price, is_enabled')
    .eq('target_type', paymentTargetType)
    .eq('target_id', targetId)
    .eq('subscription_type', subscriptionType)
    .maybeSingle();

  if (settingResult.error) {
    throw new Error('구독 설정을 확인하지 못했습니다.');
  }

  if (!settingResult.data) {
    throw new Error('구독 설정을 찾을 수 없습니다.');
  }

  const setting = settingResult.data as SubscriptionSettingRow;

  if (!setting.is_enabled) {
    throw new Error('구독이 활성화되어 있지 않습니다.');
  }

  return setting;
}

async function getOwnerStigma({ supabaseAdmin, ownerId }: { supabaseAdmin: SupabaseAdminClient; ownerId: string }) {
  const ownerStigmaResult = await supabaseAdmin.from('stigmas').select('id, user_id').eq('id', ownerId).maybeSingle();

  if (ownerStigmaResult.error) {
    throw new Error('사이트 오너 정보를 확인하지 못했습니다.');
  }

  if (!ownerStigmaResult.data) {
    throw new Error('사이트 오너 정보를 찾을 수 없습니다.');
  }

  return ownerStigmaResult.data as OwnerStigmaRow;
}

async function hasActiveSubscription({
  supabaseAdmin,
  authUserId,
  subscriptionType,
  paymentTargetType,
  targetId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  authUserId: string;
  subscriptionType: string;
  paymentTargetType: string;
  targetId: string;
}) {
  const existingActiveSubscriptionResult = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('subscriber_user_id', authUserId)
    .eq('subscription_type', subscriptionType)
    .eq('target_type', paymentTargetType)
    .eq('target_id', targetId)
    .in('status', [SUBSCRIPTION_STATUS.TRIALING, SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PAST_DUE])
    .is('canceled_at', null)
    .is('expired_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (existingActiveSubscriptionResult.error) {
    throw new Error('기존 구독 상태를 확인하지 못했습니다.');
  }

  return (existingActiveSubscriptionResult.data ?? []).length > 0;
}

async function cancelSeriesSubscriptionsInBoard({
  supabaseAdmin,
  authUserId,
  siteId,
  boardId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  authUserId: string;
  siteId: string;
  boardId: string;
}) {
  const seriesResult = await supabaseAdmin
    .from('board_series')
    .select('id')
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .eq('is_subscription', true);

  if (seriesResult.error) {
    throw new Error('연재 구독 상태를 확인하지 못했습니다.');
  }

  const seriesIds = (seriesResult.data ?? []).map((item) => normalizeText(item.id)).filter(Boolean);

  if (seriesIds.length === 0) {
    return;
  }

  const now = new Date().toISOString();

  const cancelResult = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: SUBSCRIPTION_STATUS.CANCELED,
      canceled_at: now,
      cancel_reason: 'board_subscription_started',
    })
    .eq('subscriber_user_id', authUserId)
    .eq('site_id', siteId)
    .eq('subscription_type', SUBSCRIPTION_TYPE.SERIES_SUBSCRIPTION)
    .eq('target_type', PAYMENT_TARGET_TYPE.SERIES)
    .in('target_id', seriesIds)
    .in('status', [SUBSCRIPTION_STATUS.TRIALING, SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PAST_DUE])
    .is('canceled_at', null)
    .is('expired_at', null);

  if (cancelResult.error) {
    throw new Error('기존 연재 구독을 취소하지 못했습니다.');
  }
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

    const site = await getSiteByName({
      supabaseAdmin,
      siteName,
    });

    const session = await verifySession({
      siteId: site.id,
    });

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

    const subscriptionType = getSubscriptionType(targetType);
    const paymentType = getPaymentType(targetType);
    const paymentTargetType = getPaymentTargetType(targetType);

    const setting = await getSubscriptionSetting({
      supabaseAdmin,
      paymentTargetType,
      targetId: subscriptionTarget.targetId,
      subscriptionType,
    });

    const hasSubscription = await hasActiveSubscription({
      supabaseAdmin,
      authUserId: session.authUserId,
      subscriptionType,
      paymentTargetType,
      targetId: subscriptionTarget.targetId,
    });

    if (hasSubscription) {
      return Response.json({ error: '이미 구독 중입니다.' }, { status: 400 });
    }

    const ownerStigma = await getOwnerStigma({
      supabaseAdmin,
      ownerId: site.owner_id,
    });

    const customerKey = createCustomerKey(session.authUserId);
    const orderNo = createSubscriptionOrderNo(targetType);
    const orderName =
      normalizeText(body.orderName) ||
      `${subscriptionTarget.targetLabel ?? (targetType === 'series' ? '연재' : '게시판')} 구독`;

    const billingMethodResult = await supabaseAdmin
      .from('subscription_billing_methods')
      .select('id, customer_key, billing_key')
      .eq('user_id', session.authUserId)
      .eq('provider', PAYMENT_PROVIDER.TOSS)
      .eq('is_default', true)
      .limit(1);

    if (billingMethodResult.error) {
      console.error(billingMethodResult.error);

      return Response.json({ error: '등록된 결제수단을 확인하지 못했습니다.' }, { status: 500 });
    }

    const billingMethods = (billingMethodResult.data ?? []) as unknown as BillingMethodRow[];
    const billingMethod = billingMethods[0] ?? null;

    successUrl.searchParams.set('siteName', siteName);
    successUrl.searchParams.set('boardName', boardName);
    successUrl.searchParams.set('targetType', targetType);
    successUrl.searchParams.set('orderNo', orderNo);
    successUrl.searchParams.set('paymentType', paymentType);

    failUrl.searchParams.set('siteName', siteName);
    failUrl.searchParams.set('boardName', boardName);
    failUrl.searchParams.set('targetType', targetType);
    failUrl.searchParams.set('orderNo', orderNo);
    failUrl.searchParams.set('paymentType', paymentType);

    if (targetType === 'series') {
      successUrl.searchParams.set('seriesName', seriesName);
      failUrl.searchParams.set('seriesName', seriesName);
    }

    if (!billingMethod) {
      successUrl.searchParams.set('customerKey', customerKey);

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
    const billingAnchorDay = getBillingAnchorDay(now);
    const billingPeriod = createNextMonthlyBillingPeriod({
      currentPeriodEnd: now,
      billingAnchorDay,
    });
    const refundableUntil = getRefundableUntil(now);

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
        payment_type: paymentType,
        target_type: paymentTargetType,
        target_id: subscriptionTarget.targetId,
        post_payment: null,
        subscription_id: null,
        failure_code: null,
        failure_message: null,
        failure_stage: null,
        refund_policy: REFUND_POLICY.SEVEN_DAYS,
        refundable_until: refundableUntil.toISOString(),
        approved_at: tossPaymentResult.approvedAt,
        refunded_at: null,
        raw_data: tossPaymentResult,
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
        site_id: site.id,
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
        billing_anchor_day: billingAnchorDay,
      })
      .select('id')
      .single();

    if (subscriptionInsertResult.error) {
      console.error(subscriptionInsertResult.error);

      return Response.json({ error: '구독 정보를 저장하지 못했습니다.' }, { status: 500 });
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
      siteOwnerUserId: ownerStigma.user_id,
      amount: setting.price,
    });

    if (targetType === 'board') {
      await cancelSeriesSubscriptionsInBoard({
        supabaseAdmin,
        authUserId: session.authUserId,
        siteId: site.id,
        boardId: subscriptionTarget.boardId,
      });
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
