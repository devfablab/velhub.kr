import { encrypt } from '@/lib/encryption/encrypt';
import { createMonthlyBillingPeriod } from '@/lib/payments/billingPeriod';
import { issueTossBillingKey, requestTossBillingPayment } from '@/lib/payments/toss';
import { PAYMENT_TARGET_TYPE, PAYMENT_TYPE, SUBSCRIPTION_STATUS, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SubscriptionTargetType = 'board' | 'series';

type SubscriptionSuccessBody = {
  authKey?: string;
  customerKey?: string;
  orderNo?: string;
  siteName?: string;
  boardName?: string;
  targetType?: string;
  seriesName?: string | null;
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
    const body = (await request.json()) as SubscriptionSuccessBody;
    const authKey = normalizeText(body.authKey);
    const customerKey = normalizeText(body.customerKey);
    const orderNo = normalizeText(body.orderNo);
    const siteName = normalizeText(body.siteName).toLowerCase();
    const boardName = normalizeText(body.boardName).toLowerCase();
    const targetType = getTargetType(normalizeText(body.targetType));
    const seriesName = normalizeText(body.seriesName).toLowerCase();

    if (!authKey) {
      return Response.json({ error: 'authKey가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!customerKey) {
      return Response.json({ error: 'customerKey가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!orderNo) {
      return Response.json({ error: 'orderNo가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!boardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!targetType) {
      return Response.json({ error: 'targetType이 유효하지 않습니다.' }, { status: 400 });
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
      .eq('provider', 'toss')
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
      .eq('provider', 'toss')
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
          updated_at: new Date().toISOString(),
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
          provider: 'toss',
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

    const orderName = `${subscriptionTarget.targetLabel ?? (targetType === 'series' ? '연재' : '게시판')} 구독`;

    const tossPaymentResult = (await requestTossBillingPayment({
      billingKey: billingKeyResult.billingKey,
      customerKey,
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
        billing_key: encrypt(billingKeyResult.billingKey),
        customer_key: customerKey,
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
      ok: true,
      subscriptionId: subscriptionInsertResult.data.id,
      paymentId: paymentInsertResult.data.id,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '구독을 완료하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '구독을 완료하지 못했습니다.' }, { status: 500 });
  }
}
