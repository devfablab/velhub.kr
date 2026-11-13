import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { NOTIFICATION_TYPE } from '@/lib/notifications/types';
import { createNextMonthlyBillingPeriod } from '@/lib/payments/billingPeriod';
import { getPaymentCustomer } from '@/lib/payments/customer';
import { createPaymentOrderNo } from '@/lib/payments/orderNo';
import {
  assertPortOnePaidPayment,
  createPortOnePaymentKey,
  getCurrentPortOneProvider,
  getPortOnePaidAmount,
  getPortOnePaidAt,
  getPortOnePaymentFromResponse,
  getPortOnePaymentTransactionNo,
  PortOneApiError,
  type PortOnePayment,
  requestPortOneBillingPayment,
} from '@/lib/payments/portone';
import { getPastDueGraceDays } from '@/lib/payments/refunds';
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

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

const DAY_MS = 24 * 60 * 60 * 1000;

type SubscriptionRow = {
  id: string;
  subscriber_user_id: string;
  subscription_type: string;
  target_type: string;
  target_id: string;
  owner_user_id: string | null;
  price: number;
  billing_key: string;
  customer_key: string;
  next_billing_at: string;
  billing_anchor_day: number;
  status: string;
  past_due_started_at: string | null;
  updated_at: string | null;
};

type SeriesRow = {
  id: string;
  site_id: string;
  board_id: string;
};

type SplitTarget = {
  siteId: string;
  boardId: string | null;
  seriesId: string | null;
};

type ChargeDueResult = {
  subscriptionId: string;
  status: 'paid' | 'past_due' | 'skipped' | 'internal_error';
  paymentId?: string;
  message?: string;
};

function isTestMode() {
  return process.env.NEXT_PUBLIC_APP_ENV === 'test';
}

function verifyTaskRequest(request: Request) {
  if (isTestMode()) {
    return true;
  }

  const taskSecret = process.env.CRON_SECRET ?? process.env.PAYMENT_TASK_SECRET;

  if (!taskSecret) {
    return false;
  }

  const authorization = request.headers.get('authorization');
  const expectedAuthorization = `Bearer ${taskSecret}`;

  return authorization === expectedAuthorization;
}

const MEMBERSHIP_REFUNDABLE_MS = 30 * 24 * 60 * 60 * 1000;

function isMembershipSubscription(subscription: SubscriptionRow) {
  return (
    subscription.subscription_type === SUBSCRIPTION_TYPE.MEMBERSHIP &&
    subscription.target_type === PAYMENT_TARGET_TYPE.MEMBERSHIP
  );
}

function isSeriesSubscription(subscription: SubscriptionRow) {
  return (
    subscription.subscription_type === SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES &&
    subscription.target_type === PAYMENT_TARGET_TYPE.SERIES
  );
}

function isSiteSubscription(subscription: SubscriptionRow) {
  return (
    subscription.subscription_type === SUBSCRIPTION_TYPE.SUBSCRIPTION_SITE &&
    subscription.target_type === PAYMENT_TARGET_TYPE.SITE
  );
}

function isOwnerRevenueSubscription(subscription: SubscriptionRow) {
  return isSeriesSubscription(subscription) || isSiteSubscription(subscription);
}

function createOrderNo(subscription: SubscriptionRow) {
  if (isMembershipSubscription(subscription)) return createPaymentOrderNo('MEMBERSHIP');
  if (isSiteSubscription(subscription)) return createPaymentOrderNo('SUBSCRIPTION_SITE');

  return createPaymentOrderNo('SUBSCRIPTION_SERIES');
}

function getPaymentType(subscription: SubscriptionRow) {
  if (isSeriesSubscription(subscription)) {
    return PAYMENT_TYPE.SUBSCRIPTION_SERIES;
  }

  if (isSiteSubscription(subscription)) {
    return PAYMENT_TYPE.SUBSCRIPTION_SITE;
  }

  if (isMembershipSubscription(subscription)) {
    return PAYMENT_TYPE.MEMBERSHIP;
  }

  return null;
}

function getMembershipLabel(membershipType: string | null | undefined) {
  if (membershipType === 'all_in_one') return '올인원';
  if (membershipType === 'creator') return '크리에이터';
  if (membershipType === 'owner') return '오너';

  return '아페토';
}

async function getOrderName(supabaseAdmin: SupabaseAdminClient, subscription: SubscriptionRow) {
  if (isMembershipSubscription(subscription)) {
    const membershipResult = await supabaseAdmin
      .from('memberships')
      .select('membership_type')
      .eq('id', subscription.target_id)
      .maybeSingle();

    if (membershipResult.error) {
      throw new Error('멤버십 정보를 확인하지 못했습니다.');
    }

    return `${getMembershipLabel(membershipResult.data?.membership_type as string | null | undefined)} 멤버십`;
  }

  if (isSiteSubscription(subscription)) {
    return '데브허브 블로그 구독';
  }

  return '데브허브 연재 구독';
}

function getRefundTerms(subscription: SubscriptionRow, approvedAt: string | null) {
  if (isMembershipSubscription(subscription)) {
    const approvedTime = approvedAt ? new Date(approvedAt).getTime() : Date.now();

    return {
      refundPolicy: REFUND_POLICY.MEMBERSHIP,
      refundableUntil: new Date(
        (Number.isNaN(approvedTime) ? Date.now() : approvedTime) + MEMBERSHIP_REFUNDABLE_MS,
      ).toISOString(),
    };
  }

  return { refundPolicy: REFUND_POLICY.SEVEN_DAYS, refundableUntil: null };
}

async function getSplitTarget({
  supabaseAdmin,
  subscription,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: SubscriptionRow;
}): Promise<SplitTarget> {
  if (subscription.target_type === PAYMENT_TARGET_TYPE.SITE) {
    return {
      siteId: subscription.target_id,
      boardId: null,
      seriesId: null,
    };
  }

  if (subscription.target_type === PAYMENT_TARGET_TYPE.SERIES) {
    const seriesResult = await supabaseAdmin
      .from('board_series')
      .select('id, site_id, board_id')
      .eq('id', subscription.target_id)
      .maybeSingle();

    if (seriesResult.error) {
      throw new Error('연재 정보를 확인하지 못했습니다.');
    }

    if (!seriesResult.data) {
      throw new Error('연재 정보를 찾을 수 없습니다.');
    }

    const series = seriesResult.data as SeriesRow;

    return {
      siteId: series.site_id,
      boardId: series.board_id,
      seriesId: series.id,
    };
  }

  throw new Error('구독 대상 정보를 확인할 수 없습니다.');
}

async function markPastDue({
  supabaseAdmin,
  subscription,
  orderNo,
  paymentType,
  failureCode,
  message,
  rawData,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: SubscriptionRow;
  orderNo: string;
  paymentType: string;
  failureCode: string | null;
  message: string;
  rawData: unknown;
}) {
  const nowIso = new Date().toISOString();
  const isFirstFailure = subscription.status !== SUBSCRIPTION_STATUS.PAST_DUE;

  const paymentInsertResult = await supabaseAdmin.from('payments').insert({
    provider: getCurrentPortOneProvider(),
    payment_key: null,
    order_no: orderNo,
    buyer_user_id: subscription.subscriber_user_id,
    amount: subscription.price,
    refunded_amount: 0,
    currency: 'KRW',
    status: PAYMENT_STATUS.FAILED,
    payment_method: PAYMENT_METHOD.CARD,
    payment_type: paymentType,
    target_type: subscription.target_type,
    target_id: subscription.target_id,
    post_payment: null,
    subscription_id: subscription.id,
    failure_code: failureCode,
    failure_message: message,
    failure_stage: 'subscription_charge_due',
    refund_policy: getRefundTerms(subscription, null).refundPolicy,
    refundable_until: null,
    approved_at: null,
    refunded_at: null,
    raw_data: rawData,
  });

  if (paymentInsertResult.error) {
    console.error(paymentInsertResult.error);
  }

  const subscriptionUpdateResult = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: SUBSCRIPTION_STATUS.PAST_DUE,
      ...(isFirstFailure ? { past_due_started_at: nowIso } : {}),
      updated_at: nowIso,
    })
    .eq('id', subscription.id);

  if (subscriptionUpdateResult.error) {
    console.error(subscriptionUpdateResult.error);
  }

  if (isFirstFailure && subscription.subscription_type === SUBSCRIPTION_TYPE.MEMBERSHIP) {
    const notificationResult = await supabaseAdmin.from('notifications').insert({
      user_id: subscription.subscriber_user_id,
      send_user_id: null,
      target_id: subscription.target_id,
      send_site_id: null,
      send_board_id: null,
      send_series_id: null,
      send_post_id: null,
      notification_type: NOTIFICATION_TYPE.MEMBERSHIP_PAYMENT_FAILED,
      is_read: false,
    });

    if (notificationResult.error) {
      console.error(notificationResult.error);
    }
  }
}

async function requestDuePayment({
  supabaseAdmin,
  subscription,
  orderNo,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: SubscriptionRow;
  orderNo: string;
}) {
  const paymentKey = createPortOnePaymentKey(orderNo);
  const billingKey = decrypt(subscription.billing_key);
  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('user_id')
    .eq('id', subscription.subscriber_user_id)
    .maybeSingle();

  if (stigmaResult.error || !stigmaResult.data?.user_id) {
    throw new Error('결제에 필요한 고객 정보를 확인하지 못했습니다.');
  }

  const customer = await getPaymentCustomer(stigmaResult.data.user_id);
  if (!customer) {
    throw new Error('결제에 필요한 고객 정보를 확인하지 못했습니다.');
  }

  const paymentResponse = await requestPortOneBillingPayment({
    paymentId: paymentKey,
    billingKey,
    customerId: subscription.customer_key,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhoneNumber: customer.phoneNumber,
    amount: subscription.price,
    orderName: await getOrderName(supabaseAdmin, subscription),
  });

  const payment = getPortOnePaymentFromResponse(paymentResponse);
  assertPortOnePaidPayment(payment);

  return {
    paymentKey,
    payment,
  };
}

async function chargeDue(request: Request): Promise<Response> {
  if (!verifyTaskRequest(request)) {
    return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const subscriptionsResult = await supabaseAdmin
    .from('subscriptions')
    .select(
      [
        'id',
        'subscriber_user_id',
        'subscription_type',
        'target_type',
        'target_id',
        'owner_user_id',
        'price',
        'billing_key',
        'customer_key',
        'next_billing_at',
        'billing_anchor_day',
        'status',
        'past_due_started_at',
        'updated_at',
      ].join(', '),
    )
    .in('subscription_type', [
      SUBSCRIPTION_TYPE.SUBSCRIPTION_SITE,
      SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES,
      SUBSCRIPTION_TYPE.MEMBERSHIP,
    ])
    .in('target_type', [PAYMENT_TARGET_TYPE.SITE, PAYMENT_TARGET_TYPE.SERIES, PAYMENT_TARGET_TYPE.MEMBERSHIP])
    .in('status', [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING, SUBSCRIPTION_STATUS.PAST_DUE])
    .is('canceled_at', null)
    .is('expired_at', null)
    .not('billing_key', 'is', null)
    .not('customer_key', 'is', null)
    .not('next_billing_at', 'is', null)
    .not('billing_anchor_day', 'is', null)
    .lte('next_billing_at', nowIso);

  if (subscriptionsResult.error) {
    console.error(subscriptionsResult.error);
    return Response.json({ error: '결제 대상 구독을 확인하지 못했습니다.' }, { status: 500 });
  }

  const subscriptions = (subscriptionsResult.data ?? []) as unknown as SubscriptionRow[];
  const results: ChargeDueResult[] = [];

  const nowTime = Date.now();
  const graceMs = getPastDueGraceDays() * DAY_MS;

  for (const subscription of subscriptions) {
    if (subscription.status === SUBSCRIPTION_STATUS.PAST_DUE) {
      const pastDueStartedTime = subscription.past_due_started_at
        ? new Date(subscription.past_due_started_at).getTime()
        : Number.NaN;

      if (Number.isNaN(pastDueStartedTime) || nowTime - pastDueStartedTime >= graceMs) {
        results.push({
          subscriptionId: subscription.id,
          status: 'skipped',
          message: '결제 유예 기간이 지났습니다.',
        });
        continue;
      }

      const lastAttemptTime = subscription.updated_at
        ? new Date(subscription.updated_at).getTime()
        : pastDueStartedTime;

      if (nowTime - lastAttemptTime < DAY_MS) {
        results.push({
          subscriptionId: subscription.id,
          status: 'skipped',
          message: '마지막 결제 시도 후 24시간이 지나지 않았습니다.',
        });
        continue;
      }
    }

    const paymentType = getPaymentType(subscription);

    if (!paymentType) {
      results.push({
        subscriptionId: subscription.id,
        status: 'skipped',
        message: '결제 대상 구독 타입이 아닙니다.',
      });
      continue;
    }

    const orderNo = createOrderNo(subscription);

    let paymentKey = '';
    let payment: PortOnePayment;

    try {
      const duePayment = await requestDuePayment({
        supabaseAdmin,
        subscription,
        orderNo,
      });

      paymentKey = duePayment.paymentKey;
      payment = duePayment.payment;
    } catch (unknownError) {
      const message =
        unknownError instanceof Error ? unknownError.message || '정기결제에 실패했습니다.' : '정기결제에 실패했습니다.';
      const failureCode = unknownError instanceof PortOneApiError ? unknownError.code : null;
      const rawData = unknownError instanceof PortOneApiError ? unknownError.rawData : { message };

      await markPastDue({
        supabaseAdmin,
        subscription,
        orderNo,
        paymentType,
        failureCode,
        message,
        rawData,
      });

      results.push({
        subscriptionId: subscription.id,
        status: 'past_due',
        message,
      });
      continue;
    }

    const paidAmount = getPortOnePaidAmount(payment) || subscription.price;
    const approvedAt = getPortOnePaidAt(payment);
    const refundTerms = getRefundTerms(subscription, approvedAt);
    const issues: string[] = [];

    const paymentInsertResult = await supabaseAdmin
      .from('payments')
      .insert({
        provider: getCurrentPortOneProvider(),
        payment_key: paymentKey,
        tx_no: null,
        transaction_no: getPortOnePaymentTransactionNo(payment),
        order_no: orderNo,
        buyer_user_id: subscription.subscriber_user_id,
        amount: paidAmount,
        refunded_amount: 0,
        currency: 'KRW',
        status: PAYMENT_STATUS.PAID,
        payment_method: PAYMENT_METHOD.CARD,
        payment_type: paymentType,
        target_type: subscription.target_type,
        target_id: subscription.target_id,
        post_payment: null,
        subscription_id: subscription.id,
        failure_code: null,
        failure_message: null,
        failure_stage: null,
        refund_policy: refundTerms.refundPolicy,
        refundable_until: refundTerms.refundableUntil,
        approved_at: approvedAt,
        refunded_at: null,
        raw_data: payment,
      })
      .select('id')
      .single();

    const paymentId = paymentInsertResult.error ? null : ((paymentInsertResult.data?.id as string | undefined) ?? null);

    if (!paymentId) {
      console.error('[charge-due] payment insert error', subscription.id, paymentKey, paymentInsertResult.error);
      issues.push('결제는 승인되었으나 결제 정보 저장에 실패했습니다.');
    }

    if (paymentId && isOwnerRevenueSubscription(subscription)) {
      try {
        if (!subscription.owner_user_id) {
          throw new Error('정산 대상 운영자 정보가 없습니다.');
        }

        const splitTarget = await getSplitTarget({
          supabaseAdmin,
          subscription,
        });

        await createOwnerPaymentSplits({
          supabaseAdmin,
          paymentId,
          siteId: splitTarget.siteId,
          siteOwnerStigmaId: subscription.owner_user_id,
          amount: paidAmount,
          boardId: splitTarget.boardId,
          seriesId: splitTarget.seriesId,
        });
      } catch (unknownError) {
        console.error('[charge-due] split error', subscription.id, unknownError);
        issues.push('결제는 완료되었으나 결제 분배 내역 저장에 실패했습니다.');
      }
    }

    const nextBillingPeriod = createNextMonthlyBillingPeriod({
      currentPeriodEnd: subscription.next_billing_at,
      billingAnchorDay: subscription.billing_anchor_day,
    });

    const subscriptionUpdateResult = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        ...(paymentId ? { last_payment_id: paymentId } : {}),
        current_period_start: nextBillingPeriod.currentPeriodStart,
        current_period_end: nextBillingPeriod.currentPeriodEnd,
        next_billing_at: nextBillingPeriod.nextBillingAt,
        past_due_started_at: null,
        updated_at: nowIso,
      })
      .eq('id', subscription.id);

    if (subscriptionUpdateResult.error) {
      console.error('[charge-due] subscription update error', subscription.id, subscriptionUpdateResult.error);
      issues.push('결제는 완료되었으나 구독 기간 갱신에 실패했습니다.');
    }

    results.push(
      issues.length > 0
        ? {
            subscriptionId: subscription.id,
            status: 'internal_error',
            ...(paymentId ? { paymentId } : {}),
            message: issues.join(' '),
          }
        : {
            subscriptionId: subscription.id,
            status: 'paid',
            paymentId: paymentId ?? undefined,
          },
    );
  }

  return Response.json({
    ok: true,
    chargedCount: results.filter((result) => result.status === 'paid').length,
    pastDueCount: results.filter((result) => result.status === 'past_due').length,
    skippedCount: results.filter((result) => result.status === 'skipped').length,
    internalErrorCount: results.filter((result) => result.status === 'internal_error').length,
    results,
  });
}

export async function GET(request: Request): Promise<Response> {
  return chargeDue(request);
}

export async function POST(request: Request): Promise<Response> {
  return chargeDue(request);
}
