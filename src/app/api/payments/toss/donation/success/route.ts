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
} from '@/lib/payments/types';
import { confirmTossPayment, TossPaymentConfirmError } from '@/lib/payments/toss';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type DonationSuccessBody = {
  paymentKey?: string;
  orderId?: string;
  amount?: number;
  siteId?: string;
  targetType?: string;
  boardId?: string;
  postId?: string;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string;
  site_type: string;
  owner_id: string;
  is_shutdown: boolean;
};

type BoardRow = {
  id: string;
  site_id: string;
  board_key: string;
  board_label: string | null;
  board_type: string;
  is_active: boolean;
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
  method: string;
  totalAmount: number;
  status: string;
  approvedAt: string;
  currency?: string;
};

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

async function getSiteById({ supabaseAdmin, siteId }: { supabaseAdmin: SupabaseAdminClient; siteId: string }) {
  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_label, site_type, owner_id, is_shutdown')
    .eq('id', siteId)
    .maybeSingle();

  if (siteResult.error) {
    console.error(siteResult.error);

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

async function getBoardById({
  supabaseAdmin,
  site,
  boardId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  site: SiteRow;
  boardId: string;
}) {
  if (site.site_type !== 'community') {
    throw new Error('게시판 후원은 커뮤니티에서만 가능합니다.');
  }

  if (!boardId) {
    throw new Error('boardId가 유효하지 않습니다.');
  }

  const boardResult = await supabaseAdmin
    .from('boards')
    .select('id, site_id, board_key, board_label, board_type, is_active')
    .eq('site_id', site.id)
    .eq('id', boardId)
    .maybeSingle();

  if (boardResult.error) {
    console.error(boardResult.error);

    throw new Error('게시판 정보를 불러오지 못했습니다.');
  }

  if (!boardResult.data) {
    throw new Error('게시판 정보를 찾을 수 없습니다.');
  }

  const board = boardResult.data as BoardRow;

  if (!board.is_active) {
    throw new Error('현재 후원할 수 없는 게시판입니다.');
  }

  if (board.board_type === 'page') {
    throw new Error('페이지 게시판은 후원할 수 없습니다.');
  }

  return board;
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
    console.error(postResult.error);

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

  if (!post.series_id) {
    throw new Error('연재 글만 후원할 수 있습니다.');
  }

  return post;
}

async function getSeriesById({
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
    console.error(seriesResult.error);

    throw new Error('연재 정보를 확인하지 못했습니다.');
  }

  if (!seriesResult.data) {
    throw new Error('연재 정보를 찾을 수 없습니다.');
  }

  return seriesResult.data as SeriesRow;
}

async function getBoardSeriesCount({
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
    .eq('board_id', boardId);

  if (seriesCountResult.error) {
    console.error(seriesCountResult.error);

    throw new Error('연재 개수를 확인하지 못했습니다.');
  }

  return seriesCountResult.count ?? 0;
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = (await request.json()) as DonationSuccessBody;

    const paymentKey = normalizeText(body.paymentKey);
    const orderId = normalizeText(body.orderId);
    const siteId = normalizeText(body.siteId);
    const targetType = normalizeText(body.targetType);
    const boardId = normalizeText(body.boardId);
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

    const isBoardDonation = targetType === PAYMENT_TARGET_TYPE.BOARD || (Boolean(boardId) && !postId);
    const isPostDonation = targetType === PAYMENT_TARGET_TYPE.POST || (!isBoardDonation && Boolean(postId));

    const board = isBoardDonation
      ? await getBoardById({
          supabaseAdmin,
          site,
          boardId,
        })
      : null;

    const post = isPostDonation
      ? await getPostById({
          supabaseAdmin,
          siteId: site.id,
          postId,
        })
      : null;

    if (isPostDonation && !post) {
      return Response.json({ error: '글 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (post) {
      const seriesCount = await getBoardSeriesCount({
        supabaseAdmin,
        siteId: site.id,
        boardId: post.board_id,
      });

      if (seriesCount < 2) {
        return Response.json({ error: '연재가 2개 이상 있는 게시판의 연재 글만 후원할 수 있습니다.' }, { status: 400 });
      }

      const series = await getSeriesById({
        supabaseAdmin,
        siteId: site.id,
        boardId: post.board_id,
        seriesId: post.series_id,
      });

      if (series.is_subscription === true) {
        return Response.json({ error: '구독 설정된 연재 글은 후원 대신 구매할 수 있습니다.' }, { status: 400 });
      }
    }

    const siteOwnerUserId = await getStigmaAuthUserId({
      supabaseAdmin,
      stigmaIdOrAuthUserId: site.owner_id,
      errorMessage: '사이트 오너 정보를 확인하지 못했습니다.',
    });

    const postAuthorUserId = post
      ? await getStigmaAuthUserId({
          supabaseAdmin,
          stigmaIdOrAuthUserId: post.user_id,
          errorMessage: '글 작성자 정보를 확인하지 못했습니다.',
        })
      : '';

    const existingPaymentResult = await supabaseAdmin
      .from('payments')
      .select('id, amount')
      .eq('payment_key', paymentKey)
      .limit(1);

    if (existingPaymentResult.error) {
      console.error(existingPaymentResult.error);

      return Response.json({ error: '결제 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const existingPayment = ((existingPaymentResult.data ?? [])[0] as ExistingPaymentRow | undefined) ?? null;

    if (existingPayment) {
      if (post) {
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
          boardId: board?.id ?? null,
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

    const paymentInsertResult = await supabaseAdmin
      .from('payments')
      .insert({
        provider: PAYMENT_PROVIDER.TOSS,
        payment_key: confirmResult.paymentKey,
        order_no: confirmResult.orderId,
        buyer_user_id: session.authUserId,
        amount: confirmResult.totalAmount,
        refunded_amount: 0,
        currency: confirmResult.currency || 'KRW',
        status: PAYMENT_STATUS.PAID,
        payment_method: PAYMENT_METHOD.CARD,
        payment_type: post
          ? PAYMENT_TYPE.DONATION_POST
          : board
            ? PAYMENT_TYPE.DONATION_BOARD
            : PAYMENT_TYPE.DONATION_SITE,
        target_type: post ? PAYMENT_TARGET_TYPE.POST : board ? PAYMENT_TARGET_TYPE.BOARD : PAYMENT_TARGET_TYPE.SITE,
        target_id: post ? post.id : board ? board.id : site.id,
        post_payment: post
          ? {
              site_id: site.id,
              board_id: post.board_id,
              series_id: post.series_id,
              post_id: post.id,
            }
          : null,
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

    if (post) {
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
    } else {
      await createOwnerPaymentSplits({
        supabaseAdmin,
        paymentId: paymentInsertResult.data.id,
        siteId: site.id,
        boardId: board?.id ?? null,
        siteOwnerUserId,
        amount: confirmResult.totalAmount,
      });
    }

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
