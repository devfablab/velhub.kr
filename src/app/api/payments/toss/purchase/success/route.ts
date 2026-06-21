import { NextRequest } from 'next/server';
import { getPaymentPolicyMs } from '@/lib/payments/refunds';
import { createPostPaymentSplits } from '@/lib/payments/splits';
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
import { confirmTossPayment, TossPaymentConfirmError } from '@/lib/payments/toss';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type PostPurchaseSuccessBody = {
  paymentKey?: string;
  orderId?: string;
  amount?: number;
  siteId?: string;
  postId?: string;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string;
  owner_id: string;
  is_shutdown: boolean;
};

type PostRow = {
  id: string;
  site_id: string;
  board_id: string;
  user_id: string;
  series_id: string;
  subject: string;
  published_status: string;
  is_closed: boolean;
};

type SeriesRow = {
  id: string;
  is_subscription: boolean | null;
};

type SubscriptionSettingRow = {
  id: string;
  price: number;
  is_enabled: boolean;
};

type StigmaRow = {
  id: string;
  user_id: string;
};

type ExistingPaymentRow = {
  id: string;
  amount: number;
};

type TossPaymentConfirmResult = {
  paymentKey: string;
  orderId: string;
  orderName: string;
  method: string | null;
  totalAmount: number;
  status: string;
  approvedAt: string | null;
  currency: string;
};

function getPostPurchasePrice(seriesSubscriptionPrice: number) {
  return Math.floor((seriesSubscriptionPrice * 27) / 100 / 1000) * 1000;
}

function createRefundableUntil(startedAt: Date) {
  return new Date(startedAt.getTime() + getPaymentPolicyMs()).toISOString();
}

async function hasActiveSubscription({
  supabaseAdmin,
  authUserId,
  siteId,
  targetType,
  targetId,
  subscriptionType,
}: {
  supabaseAdmin: SupabaseAdminClient;
  authUserId: string;
  siteId: string;
  targetType: string;
  targetId: string;
  subscriptionType: string;
}) {
  const subscriptionResult = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('site_id', siteId)
    .eq('subscriber_user_id', authUserId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .eq('subscription_type', subscriptionType)
    .in('status', [SUBSCRIPTION_STATUS.TRIALING, SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PAST_DUE])
    .is('expired_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (subscriptionResult.error) {
    throw new Error('구독 상태를 확인하지 못했습니다.');
  }

  return (subscriptionResult.data ?? []).length > 0;
}

async function getSiteById({ supabaseAdmin, siteId }: { supabaseAdmin: SupabaseAdminClient; siteId: string }) {
  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_label, owner_id, is_shutdown')
    .eq('id', siteId)
    .maybeSingle();

  if (siteResult.error) {
    throw new Error('사이트 정보를 불러오지 못했습니다.');
  }

  if (!siteResult.data) {
    throw new Error('사이트 정보를 찾을 수 없습니다.');
  }

  const site = siteResult.data as SiteRow;

  if (site.is_shutdown) {
    throw new Error('현재 구매할 수 없는 사이트입니다.');
  }

  return site;
}

async function getPostById({
  supabaseAdmin,
  siteId,
  postId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  postId: string;
}) {
  const postResult = await supabaseAdmin
    .from('posts')
    .select('id, site_id, board_id, user_id, series_id, subject, published_status, is_closed')
    .eq('site_id', siteId)
    .eq('id', postId)
    .maybeSingle();

  if (postResult.error) {
    throw new Error('글 정보를 불러오지 못했습니다.');
  }

  if (!postResult.data) {
    throw new Error('글 정보를 찾을 수 없습니다.');
  }

  const post = postResult.data as PostRow;

  if (post.published_status !== 'published') {
    throw new Error('공개된 글만 구매할 수 있습니다.');
  }

  if (post.is_closed) {
    throw new Error('현재 구매할 수 없는 글입니다.');
  }

  if (!post.series_id) {
    throw new Error('연재 글만 구매할 수 있습니다.');
  }

  return post;
}

async function getSeriesSubscriptionPrice({
  supabaseAdmin,
  siteId,
  boardId,
  seriesId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  boardId: string;
  seriesId: string;
}) {
  const seriesResult = await supabaseAdmin
    .from('board_series')
    .select('id, is_subscription')
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .eq('id', seriesId)
    .maybeSingle();

  if (seriesResult.error) {
    throw new Error('연재 정보를 확인하지 못했습니다.');
  }

  if (!seriesResult.data) {
    throw new Error('연재 정보를 찾을 수 없습니다.');
  }

  const series = seriesResult.data as SeriesRow;

  if (series.is_subscription !== true) {
    throw new Error('구독 설정된 연재 글만 구매할 수 있습니다.');
  }

  const subscriptionSettingResult = await supabaseAdmin
    .from('subscription_settings')
    .select('id, price, is_enabled')
    .eq('target_type', PAYMENT_TARGET_TYPE.SERIES)
    .eq('target_id', seriesId)
    .eq('subscription_type', SUBSCRIPTION_TYPE.SERIES_SUBSCRIPTION)
    .maybeSingle();

  if (subscriptionSettingResult.error) {
    throw new Error('연재 구독 설정을 확인하지 못했습니다.');
  }

  if (!subscriptionSettingResult.data) {
    throw new Error('연재 구독 설정을 찾을 수 없습니다.');
  }

  const subscriptionSetting = subscriptionSettingResult.data as SubscriptionSettingRow;

  if (!subscriptionSetting.is_enabled) {
    throw new Error('구독이 켜진 연재 글만 구매할 수 있습니다.');
  }

  return subscriptionSetting.price;
}

async function getStigmaAuthUserId({
  supabaseAdmin,
  stigmaIdOrAuthUserId,
  errorMessage,
}: {
  supabaseAdmin: SupabaseAdminClient;
  stigmaIdOrAuthUserId: string;
  errorMessage: string;
}) {
  const normalizedId = normalizeText(stigmaIdOrAuthUserId);

  if (!normalizedId) {
    throw new Error(errorMessage);
  }

  const stigmaByIdResult = await supabaseAdmin
    .from('stigmas')
    .select('id, user_id')
    .eq('id', normalizedId)
    .maybeSingle();

  if (stigmaByIdResult.error) {
    throw new Error(errorMessage);
  }

  const stigmaById = stigmaByIdResult.data as StigmaRow | null;

  if (stigmaById?.user_id) {
    return stigmaById.user_id;
  }

  const stigmaByUserIdResult = await supabaseAdmin
    .from('stigmas')
    .select('id, user_id')
    .eq('user_id', normalizedId)
    .maybeSingle();

  if (stigmaByUserIdResult.error) {
    throw new Error(errorMessage);
  }

  const stigmaByUserId = stigmaByUserIdResult.data as StigmaRow | null;

  if (stigmaByUserId?.user_id) {
    return stigmaByUserId.user_id;
  }

  return normalizedId;
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = (await request.json()) as PostPurchaseSuccessBody;
    const paymentKey = normalizeText(body.paymentKey);
    const orderId = normalizeText(body.orderId);
    const siteId = normalizeText(body.siteId);
    const postId = normalizeText(body.postId);
    const amount = body.amount;

    if (!paymentKey || !orderId || !siteId || !postId || typeof amount !== 'number') {
      return Response.json({ error: '포스팅 구매 결제 승인 정보가 없습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const site = await getSiteById({
      supabaseAdmin,
      siteId,
    });

    const post = await getPostById({
      supabaseAdmin,
      siteId: site.id,
      postId,
    });

    const seriesSubscriptionPrice = await getSeriesSubscriptionPrice({
      supabaseAdmin,
      siteId: site.id,
      boardId: post.board_id,
      seriesId: post.series_id,
    });

    const postPurchasePrice = getPostPurchasePrice(seriesSubscriptionPrice);

    if (postPurchasePrice < 1000) {
      throw new Error('포스팅 구매 금액이 1,000원 미만입니다.');
    }

    if (amount !== postPurchasePrice) {
      return Response.json({ error: '포스팅 구매 금액이 올바르지 않습니다.' }, { status: 400 });
    }

    const hasBoardSubscription = await hasActiveSubscription({
      supabaseAdmin,
      authUserId: session.authUserId,
      siteId: site.id,
      targetType: PAYMENT_TARGET_TYPE.BOARD,
      targetId: post.board_id,
      subscriptionType: SUBSCRIPTION_TYPE.BOARD_SUBSCRIPTION,
    });

    if (hasBoardSubscription) {
      return Response.json({ error: '이미 게시판 구독으로 볼 수 있는 글입니다.' }, { status: 400 });
    }

    const hasSeriesSubscription = await hasActiveSubscription({
      supabaseAdmin,
      authUserId: session.authUserId,
      siteId: site.id,
      targetType: PAYMENT_TARGET_TYPE.SERIES,
      targetId: post.series_id,
      subscriptionType: SUBSCRIPTION_TYPE.SERIES_SUBSCRIPTION,
    });

    if (hasSeriesSubscription) {
      return Response.json({ error: '이미 연재 구독으로 볼 수 있는 글입니다.' }, { status: 400 });
    }

    const existingPaymentResult = await supabaseAdmin
      .from('payments')
      .select('id, amount')
      .eq('payment_key', paymentKey)
      .limit(1);

    if (existingPaymentResult.error) {
      console.error(existingPaymentResult.error);

      return Response.json({ error: '결제 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const siteOwnerUserId = await getStigmaAuthUserId({
      supabaseAdmin,
      stigmaIdOrAuthUserId: site.owner_id,
      errorMessage: '사이트 오너 정보를 확인하지 못했습니다.',
    });

    const postAuthorUserId = await getStigmaAuthUserId({
      supabaseAdmin,
      stigmaIdOrAuthUserId: post.user_id,
      errorMessage: '글 작성자 정보를 확인하지 못했습니다.',
    });

    const existingPayment = ((existingPaymentResult.data ?? [])[0] as ExistingPaymentRow | undefined) ?? null;

    if (existingPayment) {
      await createPostPaymentSplits({
        supabaseAdmin,
        paymentId: existingPayment.id,
        siteId: site.id,
        boardId: post.board_id,
        seriesId: post.series_id,
        postId: post.id,
        siteOwnerUserId,
        postAuthorUserId,
        amount: existingPayment.amount,
      });

      return Response.json({
        ok: true,
        paymentId: existingPayment.id,
      });
    }

    const confirmResult = (await confirmTossPayment({
      paymentKey,
      orderId,
      amount,
    })) as TossPaymentConfirmResult;

    const approvedAt = confirmResult.approvedAt ? new Date(confirmResult.approvedAt) : new Date();

    const paymentInsertResult = await supabaseAdmin
      .from('payments')
      .insert({
        provider: PAYMENT_PROVIDER.TOSS,
        payment_key: confirmResult.paymentKey,
        order_no: confirmResult.orderId,
        buyer_user_id: session.authUserId,
        amount: confirmResult.totalAmount,
        refunded_amount: 0,
        currency: confirmResult.currency,
        status: PAYMENT_STATUS.PAID,
        payment_method: PAYMENT_METHOD.CARD,
        payment_type: PAYMENT_TYPE.POST_PURCHASE,
        target_type: PAYMENT_TARGET_TYPE.POST,
        target_id: post.id,
        post_payment: {
          site_id: site.id,
          board_id: post.board_id,
          series_id: post.series_id,
          post_id: post.id,
        },
        subscription_id: null,
        failure_code: null,
        failure_message: null,
        failure_stage: null,
        refund_policy: REFUND_POLICY.SEVEN_DAYS,
        refundable_until: createRefundableUntil(approvedAt),
        approved_at: confirmResult.approvedAt,
        refunded_at: null,
        raw_data: confirmResult,
      })
      .select('id')
      .single();

    if (paymentInsertResult.error) {
      console.error(paymentInsertResult.error);

      return Response.json({ error: '포스팅 구매 내역을 저장하지 못했습니다.' }, { status: 500 });
    }

    await createPostPaymentSplits({
      supabaseAdmin,
      paymentId: paymentInsertResult.data.id,
      siteId: site.id,
      boardId: post.board_id,
      seriesId: post.series_id,
      postId: post.id,
      siteOwnerUserId,
      postAuthorUserId,
      amount: confirmResult.totalAmount,
    });

    return Response.json({
      ok: true,
      paymentId: paymentInsertResult.data.id,
    });
  } catch (unknownError) {
    if (unknownError instanceof TossPaymentConfirmError) {
      console.error(unknownError.rawData);

      return Response.json({ error: unknownError.message || '포스팅 구매 결제 승인에 실패했습니다.' }, { status: 500 });
    }

    if (unknownError instanceof Error) {
      return Response.json(
        {
          error: unknownError.message || '포스팅 구매 결제를 완료하지 못했습니다.',
        },
        { status: 500 },
      );
    }

    return Response.json({ error: '포스팅 구매 결제를 완료하지 못했습니다.' }, { status: 500 });
  }
}
