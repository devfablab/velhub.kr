import { NextRequest } from 'next/server';
import { getPaymentPolicyMs } from '@/lib/payments/refunds';
import { createOwnerPaymentSplits, createPostPaymentSplits } from '@/lib/payments/splits';
import {
  PAYMENT_METHOD,
  PAYMENT_PROVIDER,
  PAYMENT_STATUS,
  PAYMENT_TARGET_TYPE,
  PAYMENT_TYPE,
  REFUND_POLICY,
  SUBSCRIPTION_TYPE,
} from '@/lib/payments/types';
import { confirmTossPayment, TossPaymentConfirmError } from '@/lib/payments/toss';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type DonationTargetType = 'site' | 'post';

type DonationSuccessBody = {
  targetType?: DonationTargetType;
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

type StigmaRow = {
  id: string;
  user_id: string;
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

type SeriesSubscriptionSettingRow = {
  id: string;
  is_enabled: boolean;
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

function normalizeDonationTargetType(value: string | null | undefined): DonationTargetType {
  return value === 'post' ? 'post' : 'site';
}

function validateDonationAmount(amount: number) {
  if (!Number.isInteger(amount)) {
    return false;
  }

  if (amount < 1000) {
    return false;
  }

  if (amount > 100000) {
    return false;
  }

  return amount % 1000 === 0;
}

function createRefundableUntil(startedAt: Date) {
  return new Date(startedAt.getTime() + getPaymentPolicyMs()).toISOString();
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
    throw new Error('현재 후원할 수 없는 사이트입니다.');
  }

  return site;
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

async function getSiteOwnerUserId({ supabaseAdmin, ownerId }: { supabaseAdmin: SupabaseAdminClient; ownerId: string }) {
  return getStigmaAuthUserId({
    supabaseAdmin,
    stigmaIdOrAuthUserId: ownerId,
    errorMessage: '사이트 오너 정보를 확인하지 못했습니다.',
  });
}

async function getPostAuthorUserId({
  supabaseAdmin,
  authorId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  authorId: string;
}) {
  return getStigmaAuthUserId({
    supabaseAdmin,
    stigmaIdOrAuthUserId: authorId,
    errorMessage: '글 작성자 정보를 확인하지 못했습니다.',
  });
}

async function getPostDonationTarget({
  supabaseAdmin,
  siteId,
  postId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  postId: string;
}) {
  if (!postId) {
    throw new Error('postId가 유효하지 않습니다.');
  }

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
    throw new Error('공개된 글만 후원할 수 있습니다.');
  }

  if (post.is_closed) {
    throw new Error('현재 후원할 수 없는 글입니다.');
  }

  const seriesSubscriptionSettingResult = await supabaseAdmin
    .from('subscription_settings')
    .select('id, is_enabled')
    .eq('target_type', PAYMENT_TARGET_TYPE.SERIES)
    .eq('target_id', post.series_id)
    .eq('subscription_type', SUBSCRIPTION_TYPE.SERIES_SUBSCRIPTION)
    .maybeSingle();

  if (seriesSubscriptionSettingResult.error) {
    throw new Error('연재 구독 설정을 확인하지 못했습니다.');
  }

  const seriesSubscriptionSetting = seriesSubscriptionSettingResult.data as SeriesSubscriptionSettingRow | null;

  if (seriesSubscriptionSetting?.is_enabled) {
    throw new Error('구독이 켜진 연재 글은 후원할 수 없습니다.');
  }

  return post;
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = (await request.json()) as DonationSuccessBody;
    const targetType = normalizeDonationTargetType(body.targetType);
    const paymentKey = normalizeText(body.paymentKey);
    const orderId = normalizeText(body.orderId);
    const siteId = normalizeText(body.siteId);
    const postId = normalizeText(body.postId);
    const amount = body.amount;

    if (!paymentKey || !orderId || !siteId || typeof amount !== 'number') {
      return Response.json({ error: '후원 결제 승인 정보가 없습니다.' }, { status: 400 });
    }

    if (!validateDonationAmount(amount)) {
      return Response.json({ error: '후원금액이 올바르지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const site = await getSiteById({
      supabaseAdmin,
      siteId,
    });

    const siteOwnerUserId = await getSiteOwnerUserId({
      supabaseAdmin,
      ownerId: site.owner_id,
    });

    const existingPaymentResult = await supabaseAdmin
      .from('payments')
      .select('id, amount')
      .eq('payment_key', paymentKey)
      .maybeSingle();

    if (existingPaymentResult.error) {
      console.error(existingPaymentResult.error);

      return Response.json({ error: '결제 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (existingPaymentResult.data) {
      const existingPayment = existingPaymentResult.data as ExistingPaymentRow;

      if (targetType === 'post') {
        const post = await getPostDonationTarget({
          supabaseAdmin,
          siteId: site.id,
          postId,
        });

        const postAuthorUserId = await getPostAuthorUserId({
          supabaseAdmin,
          authorId: post.user_id,
        });

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
      } else {
        await createOwnerPaymentSplits({
          supabaseAdmin,
          paymentId: existingPayment.id,
          siteId: site.id,
          siteOwnerUserId,
          amount: existingPayment.amount,
        });
      }

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

    if (targetType === 'post') {
      const post = await getPostDonationTarget({
        supabaseAdmin,
        siteId: site.id,
        postId,
      });

      const postAuthorUserId = await getPostAuthorUserId({
        supabaseAdmin,
        authorId: post.user_id,
      });

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
          payment_type: PAYMENT_TYPE.DONATION_POST,
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

        return Response.json({ error: '후원 결제 내역을 저장하지 못했습니다.' }, { status: 500 });
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
    }

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
        payment_type: PAYMENT_TYPE.DONATION_SITE,
        target_type: PAYMENT_TARGET_TYPE.SITE,
        target_id: site.id,
        post_payment: null,
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

      return Response.json({ error: '후원 결제 내역을 저장하지 못했습니다.' }, { status: 500 });
    }

    await createOwnerPaymentSplits({
      supabaseAdmin,
      paymentId: paymentInsertResult.data.id,
      siteId: site.id,
      siteOwnerUserId,
      amount: confirmResult.totalAmount,
    });

    return Response.json({
      ok: true,
      paymentId: paymentInsertResult.data.id,
    });
  } catch (unknownError) {
    if (unknownError instanceof TossPaymentConfirmError) {
      console.error(unknownError.rawData);

      return Response.json({ error: unknownError.message || '후원 결제 승인에 실패했습니다.' }, { status: 500 });
    }

    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '후원 결제를 완료하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '후원 결제를 완료하지 못했습니다.' }, { status: 500 });
  }
}
