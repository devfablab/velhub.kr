import { encrypt } from '@/lib/encryption/encrypt';
import { createNextMonthlyBillingPeriod, getBillingAnchorDay } from '@/lib/payments/billingPeriod';
import { enforceMinorPaymentControl } from '@/lib/payments/minorPaymentControl';
import { isPaymentOrderNo } from '@/lib/payments/orderNo';
import {
  assertPortOnePaidPayment,
  createPortOnePaymentKey,
  getCurrentPortOneProvider,
  getPortOneBillingCardInfo,
  getPortOneBillingKeyInfo,
  getPortOnePaidAmount,
  getPortOnePaidAt,
  getPortOnePayment,
  getPortOnePaymentFromResponse,
  getPortOnePaymentMethod,
  getPortOnePaymentTransactionNo,
  requestPortOneBillingPayment,
} from '@/lib/payments/portone';
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
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;
type SubscriptionTargetType = 'series' | 'site';

type SubscriptionSuccessBody = {
  billingKey?: string;
  customerKey?: string;
  paymentId?: string;
  siteName?: string;
  boardName?: string;
  targetType?: string;
  seriesName?: string | null;
  orderNo?: string;
  guardianIdentityVerificationId?: string;
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

type SubscriptionRow = {
  id: string;
  status: string;
  current_period_end: string | null;
  next_billing_at: string | null;
  canceled_at: string | null;
  expired_at: string | null;
};

type SubscriptionTarget = {
  targetId: string;
  targetLabel: string | null;
  boardId: string;
  seriesId: string | null;
  isSubscriptionTarget: boolean;
};

type PortOneBillingPaymentResult = {
  paymentKey: string;
  orderId: string;
  orderName: string;
  method: string;
  totalAmount: number;
  status: string;
  approvedAt: string;
  currency?: string;
  transactionId?: string | null;
  rawData?: unknown;
};

type PortOneDirectPayment = {
  id?: string;
  order?: { id?: string; name?: string };
  status?: string;
  amount?: { currency?: string };
};

type BillingMethodRow = {
  id: string;
  is_default: boolean;
};

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
}) {
  const paymentKey = createPortOnePaymentKey(orderId);
  const paymentResponse = await requestPortOneBillingPayment({
    paymentId: paymentKey,
    billingKey,
    customerId: customerKey,
    amount,
    orderName,
  });
  const payment = getPortOnePaymentFromResponse(paymentResponse);

  assertPortOnePaidPayment(payment);

  return {
    paymentKey,
    orderId,
    orderName: payment.orderName ?? orderName,
    method: getPortOnePaymentMethod(payment),
    totalAmount: getPortOnePaidAmount(payment) || amount,
    status: payment.status,
    approvedAt: getPortOnePaidAt(payment),
    currency: payment.amount?.currency ?? 'KRW',
    transactionId: getPortOnePaymentTransactionNo(payment),
    rawData: payment,
  };
}

function getTargetType(value: string): SubscriptionTargetType | null {
  if (value === 'series' || value === 'site') {
    return value;
  }

  return null;
}

function getSubscriptionType(targetType: SubscriptionTargetType) {
  if (targetType === 'site') {
    return SUBSCRIPTION_TYPE.SUBSCRIPTION_SITE;
  }

  return SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES;
}

function getPaymentType(targetType: SubscriptionTargetType) {
  if (targetType === 'site') {
    return PAYMENT_TYPE.SUBSCRIPTION_SITE;
  }

  return PAYMENT_TYPE.SUBSCRIPTION_SERIES;
}

function getPaymentTargetType(targetType: SubscriptionTargetType) {
  if (targetType === 'site') {
    return PAYMENT_TARGET_TYPE.SITE;
  }

  return PAYMENT_TARGET_TYPE.SERIES;
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

function isValidOrderNo(orderNo: string, targetType: SubscriptionTargetType) {
  return isPaymentOrderNo(orderNo, targetType === 'site' ? 'SUBSCRIPTION_SITE' : 'SUBSCRIPTION_SERIES');
}

async function getSiteOwnerStigmaId({
  supabaseAdmin,
  ownerId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  ownerId: string;
}) {
  const ownerStigmaResult = await supabaseAdmin.from('stigmas').select('id, user_id').eq('id', ownerId).maybeSingle();

  if (ownerStigmaResult.error) {
    throw new Error('사이트 오너 정보를 확인하지 못했습니다.');
  }

  if (!ownerStigmaResult.data) {
    throw new Error('사이트 오너 정보를 찾을 수 없습니다.');
  }

  const ownerStigma = ownerStigmaResult.data as OwnerStigmaRow;

  return ownerStigma.id;
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
  if (targetType === 'site') {
    const blogResult = await supabaseAdmin.from('blogs').select('blog_type').eq('site_id', siteId).maybeSingle();

    if (blogResult.error) {
      throw new Error('블로그 유형을 확인하지 못했습니다.');
    }

    if (blogResult.data?.blog_type === 'team') {
      throw new Error('팀 블로그는 블로그 구독을 운영할 수 없습니다.');
    }

    const siteResult = await supabaseAdmin.from('rhizomes').select('id, site_label').eq('id', siteId).maybeSingle();

    if (siteResult.error) {
      throw new Error('블로그 정보를 확인하지 못했습니다.');
    }

    if (!siteResult.data) {
      throw new Error('블로그 정보를 찾을 수 없습니다.');
    }

    return {
      targetId: siteId,
      targetLabel: siteResult.data.site_label,
      boardId: '',
      seriesId: null,
      isSubscriptionTarget: true,
    };
  }

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SubscriptionSuccessBody;
    const billingKey = normalizeText(body.billingKey);
    const customerKey = normalizeText(body.customerKey);
    const paymentId = normalizeText(body.paymentId);
    const siteName = normalizeText(body.siteName).toLowerCase();
    const boardName = normalizeText(body.boardName).toLowerCase();
    const targetType = getTargetType(normalizeText(body.targetType));
    const seriesName = normalizeText(body.seriesName).toLowerCase();
    const orderNo = normalizeText(body.orderNo);

    if ((!billingKey || !customerKey) && !paymentId) {
      return Response.json({ error: '구독 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!targetType) {
      return Response.json({ error: 'targetType이 유효하지 않습니다.' }, { status: 400 });
    }

    if (targetType !== 'site' && !boardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!orderNo) {
      return Response.json({ error: 'orderNo가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!isValidOrderNo(orderNo, targetType)) {
      return Response.json({ error: '구독 주문번호가 올바르지 않습니다.' }, { status: 400 });
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

    if (!session.authUserId || !session.stigmaId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const minorControl = await enforceMinorPaymentControl(session.stigmaId, body.guardianIdentityVerificationId);
    if (minorControl.error)
      return Response.json({ error: minorControl.error, guardianAuthRequired: true }, { status: 403 });

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

    const subscriptionType = getSubscriptionType(targetType);
    const paymentType = getPaymentType(targetType);
    const paymentTargetType = getPaymentTargetType(targetType);
    const settingResult = await supabaseAdmin
      .from('subscription_settings')
      .select('price, is_enabled')
      .eq('target_type', paymentTargetType)
      .eq('target_id', subscriptionTarget.targetId)
      .eq('subscription_type', subscriptionType)
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

    const siteOwnerStigmaId = await getSiteOwnerStigmaId({
      supabaseAdmin,
      ownerId: site.owner_id,
    });
    const latestSubscriptionResult = await supabaseAdmin
      .from('subscriptions')
      .select('id, status, current_period_end, next_billing_at, canceled_at, expired_at')
      .eq('subscriber_user_id', session.stigmaId ?? '')
      .eq('subscription_type', subscriptionType)
      .eq('target_type', paymentTargetType)
      .eq('target_id', subscriptionTarget.targetId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestSubscriptionResult.error) {
      console.error(latestSubscriptionResult.error);

      return Response.json({ error: '기존 구독 상태를 확인하지 못했습니다.' }, { status: 500 });
    }

    const latestSubscription = (latestSubscriptionResult.data as SubscriptionRow | null) ?? null;
    const now = new Date();
    const nowText = now.toISOString();

    if (isOpenSubscription(latestSubscription)) {
      return Response.json({ error: '이미 구독 중입니다.' }, { status: 400 });
    }

    if (!paymentId) {
      const billingKeyInfo = await getPortOneBillingKeyInfo(billingKey!);

      if (billingKeyInfo.status !== 'ISSUED') {
        return Response.json({ error: '발급된 빌링키를 확인하지 못했습니다.' }, { status: 400 });
      }

      const cardInfo = getPortOneBillingCardInfo(billingKeyInfo);
      const billingKeyResult = {
        billingKey: billingKey!,
        customerKey: customerKey!,
      };

      const existingDefaultBillingMethodResult = await supabaseAdmin
        .from('subscription_billing_methods')
        .select('id, is_default')
        .eq('user_id', session.stigmaId ?? '')
        .eq('provider', getCurrentPortOneProvider())
        .eq('is_default', true)
        .maybeSingle();

      if (existingDefaultBillingMethodResult.error) {
        console.error(existingDefaultBillingMethodResult.error);

        return Response.json({ error: '기본 결제수단을 확인하지 못했습니다.' }, { status: 500 });
      }

      const existingBillingMethodResult = await supabaseAdmin
        .from('subscription_billing_methods')
        .select('id, is_default')
        .eq('user_id', session.stigmaId ?? '')
        .eq('provider', getCurrentPortOneProvider())
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
            card_company: cardInfo.cardCompany,
            card_number_masked: cardInfo.cardNumberMasked,
            owner_type: cardInfo.ownerType,
            card_type: cardInfo.cardType,
            is_default: existingDefaultBillingMethodResult.data ? existingBillingMethod.is_default : true,
            updated_at: nowText,
          })
          .eq('id', existingBillingMethod.id);

        if (billingMethodUpdateResult.error) {
          console.error(billingMethodUpdateResult.error);

          return Response.json({ error: '결제수단을 갱신하지 못했습니다.' }, { status: 500 });
        }
      } else {
        if (!session.stigmaId) {
          return Response.json({ error: '로그인 정보가 올바르지 않습니다.' }, { status: 401 });
        }

        const billingMethodInsertResult = await supabaseAdmin
          .from('subscription_billing_methods')
          .insert({
            user_id: session.stigmaId,
            provider: getCurrentPortOneProvider(),
            customer_key: customerKey,
            billing_key: billingKeyResult.billingKey,
            card_company: cardInfo.cardCompany,
            card_number_masked: cardInfo.cardNumberMasked,
            owner_type: cardInfo.ownerType,
            card_type: cardInfo.cardType,
            is_default: !existingDefaultBillingMethodResult.data,
          })
          .select('id')
          .single();

        if (billingMethodInsertResult.error) {
          console.error(billingMethodInsertResult.error);

          return Response.json({ error: '결제수단을 저장하지 못했습니다.' }, { status: 500 });
        }
      }
    }

    if (isScheduledCancelSubscription(latestSubscription, now)) {
      const scheduledCancelSubscription = latestSubscription;

      if (!scheduledCancelSubscription) {
        return Response.json({ error: '취소 예약된 구독을 찾을 수 없습니다.' }, { status: 404 });
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

        return Response.json({ error: '구독 취소를 철회하지 못했습니다.' }, { status: 500 });
      }

      return Response.json({
        ok: true,
        mode: 'resume_scheduled_cancel',
        subscriptionId: latestSubscription.id,
        nextBillingAt: latestSubscription.current_period_end,
      });
    }

    let portOnePaymentResult: PortOneBillingPaymentResult;

    if (paymentId) {
      const paymentResponse = await getPortOnePayment(paymentId);
      assertPortOnePaidPayment(paymentResponse);
      const paidAmount = getPortOnePaidAmount(paymentResponse);

      if (paidAmount !== setting.price) {
        return Response.json({ error: '결제 금액이 일치하지 않습니다.' }, { status: 400 });
      }

      const payment = getPortOnePaymentFromResponse(paymentResponse) as unknown as PortOneDirectPayment;
      portOnePaymentResult = {
        paymentKey: payment.id ?? paymentId,
        orderId: payment.order?.id ?? orderNo,
        orderName: payment.order?.name ?? `${subscriptionTarget.targetLabel ?? '구독'} 1개월 구독권`,
        method: getPortOnePaymentMethod(paymentResponse),
        totalAmount: paidAmount,
        status: payment.status ?? PAYMENT_STATUS.PAID,
        approvedAt: getPortOnePaidAt(paymentResponse),
        currency: payment.amount?.currency ?? 'KRW',
        transactionId: getPortOnePaymentTransactionNo(paymentResponse),
        rawData: paymentResponse,
      };
    } else {
      const orderName = `${subscriptionTarget.targetLabel ?? (targetType === 'series' ? '연재' : '게시판')} 구독`;
      portOnePaymentResult = (await requestPortOneBillingPaymentCompat({
        billingKey: billingKey!,
        customerKey: customerKey!,
        amount: setting.price,
        orderId: orderNo,
        orderName,
      })) as PortOneBillingPaymentResult;
    }

    const billingAnchorDay = getBillingAnchorDay(now);
    const billingPeriod = createNextMonthlyBillingPeriod({
      currentPeriodEnd: now,
      billingAnchorDay,
    });
    const paymentInsertResult = await supabaseAdmin
      .from('payments')
      .insert({
        provider: getCurrentPortOneProvider(),
        payment_key: portOnePaymentResult.paymentKey,
        tx_no: null,
        transaction_no: portOnePaymentResult.transactionId ?? null,
        order_no: orderNo,
        buyer_user_id: session.stigmaId,
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
        refundable_until: createRefundableUntil(now),
        approved_at: portOnePaymentResult.approvedAt,
        refunded_at: null,
        raw_data: portOnePaymentResult.rawData ?? portOnePaymentResult,
        guardian_identity_verified: Boolean(minorControl.guardianIdentityVerificationId),
        guardian_identity_verified_at: minorControl.guardianIdentityVerificationId ? now.toISOString() : null,
        guardian_identity_verification_id: minorControl.guardianIdentityVerificationId,
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
        subscriber_user_id: session.stigmaId,
        subscription_type: subscriptionType,
        target_type: paymentTargetType,
        target_id: subscriptionTarget.targetId,
        owner_user_id: siteOwnerStigmaId,
        price: setting.price,
        status: SUBSCRIPTION_STATUS.ACTIVE,
        billing_key: paymentId ? null : encrypt(billingKey!),
        customer_key: paymentId ? null : customerKey!,
        last_payment_id: paymentInsertResult.data.id,
        trial_started_at: null,
        trial_ends_at: null,
        current_period_start: billingPeriod.currentPeriodStart,
        current_period_end: billingPeriod.currentPeriodEnd,
        next_billing_at: paymentId ? null : billingPeriod.nextBillingAt,
        billing_anchor_day: billingAnchorDay,
        canceled_at: paymentId ? nowText : null,
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
      boardId: subscriptionTarget.boardId,
      seriesId: subscriptionTarget.seriesId,
      siteOwnerStigmaId,
      amount: setting.price,
    });

    return Response.json({
      ok: true,
      mode: 'direct_billing',
      subscriptionId: subscriptionInsertResult.data.id,
      paymentId: paymentInsertResult.data.id,
    });
  } catch (unknownError) {
    console.error('[subscription success error]', unknownError);

    return Response.json({ error: '구독을 완료하지 못했습니다.' }, { status: 500 });
  }
}
