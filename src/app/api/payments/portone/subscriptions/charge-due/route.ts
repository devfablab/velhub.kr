import { decrypt } from '@/lib/encryption/decrypt';
import { createNextMonthlyBillingPeriod } from '@/lib/payments/billingPeriod';
import { createPaymentOrderNo } from '@/lib/payments/orderNo';
import { createOwnerPaymentSplits } from '@/lib/payments/splits';
import {
  PortOneApiError,
  assertPortOnePaidPayment,
  createPortOnePaymentKey,
  getCurrentPortOneProvider,
  getPortOnePaidAmount,
  getPortOnePaidAt,
  getPortOnePaymentFromResponse,
  getPortOnePaymentTransactionNo,
  requestPortOneBillingPayment,
  type PortOnePayment,
} from '@/lib/payments/portone';
import {
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PAYMENT_TARGET_TYPE,
  PAYMENT_TYPE,
  REFUND_POLICY,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TYPE,
} from '@/lib/payments/types';
import { getSupabaseAdmin } from '@/lib/supabase';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

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
};

type BoardRow = {
  id: string;
  site_id: string;
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

function createOrderNo(subscriptionType: string) {
  if (subscriptionType === SUBSCRIPTION_TYPE.SUBSCRIPTION_BOARD) {
    return createPaymentOrderNo('SUBSCRIPTION_BOARD');
  }

  return createPaymentOrderNo('SUBSCRIPTION_SERIES');
}

function getPaymentType(subscriptionType: string) {
  if (subscriptionType === SUBSCRIPTION_TYPE.SUBSCRIPTION_BOARD) {
    return PAYMENT_TYPE.SUBSCRIPTION_BOARD;
  }

  if (subscriptionType === SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES) {
    return PAYMENT_TYPE.SUBSCRIPTION_SERIES;
  }

  return null;
}

function getOrderName(subscriptionType: string) {
  if (subscriptionType === SUBSCRIPTION_TYPE.SUBSCRIPTION_BOARD) {
    return '데브허브 게시판 구독';
  }

  if (subscriptionType === SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES) {
    return '데브허브 연재 구독';
  }

  return '데브허브 구독';
}

async function getSplitTarget({
  supabaseAdmin,
  subscription,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: SubscriptionRow;
}): Promise<SplitTarget> {
  if (subscription.target_type === PAYMENT_TARGET_TYPE.BOARD) {
    const boardResult = await supabaseAdmin
      .from('boards')
      .select('id, site_id')
      .eq('id', subscription.target_id)
      .maybeSingle();

    if (boardResult.error) {
      throw new Error('게시판 정보를 확인하지 못했습니다.');
    }

    if (!boardResult.data) {
      throw new Error('게시판 정보를 찾을 수 없습니다.');
    }

    const board = boardResult.data as BoardRow;

    return {
      siteId: board.site_id,
      boardId: board.id,
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
    refund_policy: REFUND_POLICY.SEVEN_DAYS,
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
      past_due_started_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', subscription.id);

  if (subscriptionUpdateResult.error) {
    console.error(subscriptionUpdateResult.error);
  }
}

async function requestDuePayment({ subscription, orderNo }: { subscription: SubscriptionRow; orderNo: string }) {
  const paymentKey = createPortOnePaymentKey(orderNo);
  const billingKey = decrypt(subscription.billing_key);

  const paymentResponse = await requestPortOneBillingPayment({
    paymentId: paymentKey,
    billingKey,
    customerId: subscription.customer_key,
    amount: subscription.price,
    orderName: getOrderName(subscription.subscription_type),
  });

  const payment = getPortOnePaymentFromResponse(paymentResponse);
  assertPortOnePaidPayment(payment);

  return {
    paymentKey,
    payment,
  };
}

async function chargeDue(request: Request) {
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
      ].join(', '),
    )
    .in('subscription_type', [SUBSCRIPTION_TYPE.SUBSCRIPTION_BOARD, SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES])
    .in('target_type', [PAYMENT_TARGET_TYPE.BOARD, PAYMENT_TARGET_TYPE.SERIES])
    .in('status', [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING])
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

  for (const subscription of subscriptions) {
    const paymentType = getPaymentType(subscription.subscription_type);

    if (!paymentType) {
      results.push({
        subscriptionId: subscription.id,
        status: 'skipped',
        message: '결제 대상 구독 타입이 아닙니다.',
      });
      continue;
    }

    const orderNo = createOrderNo(subscription.subscription_type);

    let paymentKey = '';
    let payment: PortOnePayment;

    try {
      const duePayment = await requestDuePayment({
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
        refund_policy: REFUND_POLICY.SEVEN_DAYS,
        refundable_until: null,
        approved_at: getPortOnePaidAt(payment),
        refunded_at: null,
        raw_data: payment,
      })
      .select('id')
      .single();

    if (paymentInsertResult.error) {
      console.error(paymentInsertResult.error);
      results.push({
        subscriptionId: subscription.id,
        status: 'internal_error',
        message: '결제는 승인되었으나 결제 정보 저장에 실패했습니다.',
      });
      continue;
    }

    try {
      const splitTarget = await getSplitTarget({
        supabaseAdmin,
        subscription,
      });

      if (!subscription.owner_user_id) {
        console.error('정산 대상 오너 정보가 없습니다.');

        return {
          ok: false,
          subscriptionId: subscription.id,
        };
      }

      await createOwnerPaymentSplits({
        supabaseAdmin,
        paymentId: paymentInsertResult.data.id,
        siteId: splitTarget.siteId,
        siteOwnerUserId: subscription.owner_user_id,
        amount: paidAmount,
        boardId: splitTarget.boardId,
        seriesId: splitTarget.seriesId,
      });
    } catch (unknownError) {
      console.error(unknownError);
      results.push({
        subscriptionId: subscription.id,
        status: 'internal_error',
        paymentId: paymentInsertResult.data.id,
        message: '결제는 완료되었으나 결제 분배 내역 저장에 실패했습니다.',
      });
      continue;
    }

    const nextBillingPeriod = createNextMonthlyBillingPeriod({
      currentPeriodEnd: subscription.next_billing_at,
      billingAnchorDay: subscription.billing_anchor_day,
    });

    const subscriptionUpdateResult = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        last_payment_id: paymentInsertResult.data.id,
        current_period_start: nextBillingPeriod.currentPeriodStart,
        current_period_end: nextBillingPeriod.currentPeriodEnd,
        next_billing_at: nextBillingPeriod.nextBillingAt,
        past_due_started_at: null,
        updated_at: nowIso,
      })
      .eq('id', subscription.id);

    if (subscriptionUpdateResult.error) {
      console.error(subscriptionUpdateResult.error);
      results.push({
        subscriptionId: subscription.id,
        status: 'internal_error',
        paymentId: paymentInsertResult.data.id,
        message: '결제는 완료되었으나 구독 기간 갱신에 실패했습니다.',
      });
      continue;
    }

    results.push({
      subscriptionId: subscription.id,
      status: 'paid',
      paymentId: paymentInsertResult.data.id,
    });
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

export async function GET(request: Request) {
  return chargeDue(request);
}

export async function POST(request: Request) {
  return chargeDue(request);
}
