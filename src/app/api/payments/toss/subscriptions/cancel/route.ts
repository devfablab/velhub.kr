import {
  PAYMENT_STATUS,
  PAYMENT_TARGET_TYPE,
  PAYMENT_TYPE,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TYPE,
} from '@/lib/payments/types';
import { cancelTossPayment } from '@/lib/payments/toss';
import { calculateSubscriptionRefundAmount } from '@/lib/payments/refunds';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type SubscriptionTargetType = 'board' | 'series';

type CancelSubscriptionBody = {
  siteName?: string;
  boardName?: string;
  targetType?: string;
  seriesName?: string | null;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
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
};

type SubscriptionRow = {
  id: string;
  site_id: string;
  subscriber_user_id: string;
  subscription_type: string;
  target_type: string;
  target_id: string;
  owner_user_id: string | null;
  price: number;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
  current_period_start: string;
  current_period_end: string;
  next_billing_at: string | null;
  canceled_at: string | null;
  expired_at: string | null;
  last_payment_id: string | null;
};

type PaymentRow = {
  id: string;
  payment_key: string | null;
  amount: number;
  refunded_amount: number;
  status: 'paid' | 'failed' | 'partially_refunded' | 'refunded';
  approved_at: string | null;
  created_at: string;
};

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
}) {
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

  if (targetType === 'board') {
    return {
      targetId: board.id,
      targetLabel: board.board_label,
    };
  }

  if (!seriesName) {
    throw new Error('seriesName이 유효하지 않습니다.');
  }

  const seriesResult = await supabaseAdmin
    .from('board_series')
    .select('id, series_key, series_label')
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
  };
}

async function getLastPayment({
  supabaseAdmin,
  subscription,
  authUserId,
  paymentType,
  paymentTargetType,
  targetId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: SubscriptionRow;
  authUserId: string;
  paymentType: string;
  paymentTargetType: string;
  targetId: string;
}) {
  if (subscription.last_payment_id) {
    const paymentResult = await supabaseAdmin
      .from('payments')
      .select('id, payment_key, amount, refunded_amount, status, approved_at, created_at')
      .eq('id', subscription.last_payment_id)
      .maybeSingle();

    if (paymentResult.error) {
      throw new Error('결제 정보를 확인하지 못했습니다.');
    }

    return (paymentResult.data as PaymentRow | null) ?? null;
  }

  const paymentResult = await supabaseAdmin
    .from('payments')
    .select('id, payment_key, amount, refunded_amount, status, approved_at, created_at')
    .eq('buyer_user_id', authUserId)
    .eq('payment_type', paymentType)
    .eq('target_type', paymentTargetType)
    .eq('target_id', targetId)
    .in('status', [PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_REFUNDED])
    .order('created_at', { ascending: false })
    .limit(1);

  if (paymentResult.error) {
    throw new Error('결제 정보를 확인하지 못했습니다.');
  }

  return ((paymentResult.data ?? [])[0] as PaymentRow | undefined) ?? null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CancelSubscriptionBody;
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

    const supabaseAdmin = getSupabaseAdmin();

    const siteResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label')
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
    const now = new Date();
    const nowText = now.toISOString();

    const subscriptionResult = await supabaseAdmin
      .from('subscriptions')
      .select(
        [
          'id',
          'subscriber_user_id',
          'subscription_type',
          'target_type',
          'target_id',
          'price',
          'status',
          'last_payment_id',
          'current_period_start',
          'current_period_end',
          'next_billing_at',
          'canceled_at',
          'expired_at',
        ].join(', '),
      )
      .eq('site_id', site.id)
      .eq('subscriber_user_id', session.authUserId)
      .eq('subscription_type', subscriptionType)
      .eq('target_type', paymentTargetType)
      .eq('target_id', subscriptionTarget.targetId)
      .in('status', [SUBSCRIPTION_STATUS.TRIALING, SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PAST_DUE])
      .order('created_at', { ascending: false })
      .limit(1);

    if (subscriptionResult.error) {
      console.error(subscriptionResult.error);

      return Response.json({ error: '구독 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const subscription = ((subscriptionResult.data ?? [])[0] as unknown as SubscriptionRow | undefined) ?? null;

    if (!subscription) {
      return Response.json({ error: '취소할 구독을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (subscription.canceled_at && subscription.next_billing_at === null) {
      return Response.json({ error: '이미 취소된 구독입니다.' }, { status: 400 });
    }

    const payment = await getLastPayment({
      supabaseAdmin,
      subscription,
      authUserId: session.authUserId,
      paymentType,
      paymentTargetType,
      targetId: subscriptionTarget.targetId,
    });

    if (!payment) {
      const subscriptionUpdateResult = await supabaseAdmin
        .from('subscriptions')
        .update({
          canceled_at: nowText,
          next_billing_at: null,
          updated_at: nowText,
        })
        .eq('id', subscription.id);

      if (subscriptionUpdateResult.error) {
        console.error(subscriptionUpdateResult.error);

        return Response.json({ error: '구독을 취소하지 못했습니다.' }, { status: 500 });
      }

      return Response.json({
        ok: true,
        mode: 'cancel_scheduled',
        refundAmount: 0,
        retainedAmount: subscription.price,
      });
    }

    if (payment.status === PAYMENT_STATUS.REFUNDED) {
      return Response.json({ error: '이미 환불된 결제입니다.' }, { status: 400 });
    }

    if (payment.refunded_amount > 0) {
      return Response.json({ error: '이미 일부 환불된 결제입니다.' }, { status: 400 });
    }

    const paidAt = payment.approved_at ?? payment.created_at;
    const refundCalculation = calculateSubscriptionRefundAmount({
      amount: payment.amount,
      paidAt,
      now,
    });

    if (!refundCalculation.isRefundable) {
      const subscriptionUpdateResult = await supabaseAdmin
        .from('subscriptions')
        .update({
          next_billing_at: null,
          canceled_at: nowText,
          updated_at: nowText,
        })
        .eq('id', subscription.id);

      if (subscriptionUpdateResult.error) {
        console.error(subscriptionUpdateResult.error);

        return Response.json({ error: '구독 취소를 예약하지 못했습니다.' }, { status: 500 });
      }

      return Response.json({
        ok: true,
        mode: 'cancel_scheduled',
        refundAmount: 0,
        retainedAmount: payment.amount,
      });
    }

    if (!payment.payment_key) {
      return Response.json({ error: '결제 취소에 필요한 paymentKey가 없습니다.' }, { status: 400 });
    }

    const tossCancelResult = await cancelTossPayment({
      paymentKey: payment.payment_key,
      cancelReason: targetType === 'board' ? '게시판 구독 환불' : '연재 구독 환불',
      cancelAmount: refundCalculation.isFullRefund ? undefined : refundCalculation.refundAmount,
    });

    const paymentStatus =
      refundCalculation.refundAmount >= payment.amount ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIALLY_REFUNDED;

    const paymentUpdateResult = await supabaseAdmin
      .from('payments')
      .update({
        status: paymentStatus,
        refunded_amount: refundCalculation.refundAmount,
        refunded_at: nowText,
        raw_data: tossCancelResult,
      })
      .eq('id', payment.id);

    if (paymentUpdateResult.error) {
      console.error(paymentUpdateResult.error);

      return Response.json({ error: '결제 환불 정보를 저장하지 못했습니다.' }, { status: 500 });
    }

    const subscriptionUpdateResult = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: SUBSCRIPTION_STATUS.CANCELED,
        next_billing_at: null,
        canceled_at: nowText,
        expired_at: nowText,
        updated_at: nowText,
      })
      .eq('id', subscription.id);

    if (subscriptionUpdateResult.error) {
      console.error(subscriptionUpdateResult.error);

      return Response.json({ error: '구독 정보를 갱신하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      mode: refundCalculation.isFullRefund ? 'full_refund' : 'partial_refund',
      refundAmount: refundCalculation.refundAmount,
      retainedAmount: refundCalculation.retainedAmount,
      usedDays: refundCalculation.usedDays,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '구독 취소에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '구독 취소에 실패했습니다.' }, { status: 500 });
  }
}
