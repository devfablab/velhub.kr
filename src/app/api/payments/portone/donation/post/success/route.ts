import { NextRequest } from 'next/server';
import { refreshCommunityMemberLevel } from '@/lib/community/community-levels/refreshMemberLevel';
import { assertCommunityCommentWritePolicy, increaseCommunityCommentCount } from '@/lib/community/policies';
import { getKoreanAge } from '@/lib/identity/age';
import { getChorogonBirthDate } from '@/lib/identity/chorogon';
import { NOTIFICATION_TYPE } from '@/lib/notifications/types';
import { hasValidSeriesSubscription } from '@/lib/payments/blogDonation';
import { enforceMinorPaymentControl } from '@/lib/payments/minorPaymentControl';
import { assertReadyPaymentOrder, completePaymentOrder, getPaymentOrder } from '@/lib/payments/paymentOrder';
import {
  assertPortOnePaidPayment,
  getCurrentPortOneProvider,
  getPortOnePaidAmount,
  getPortOnePaidAt,
  getPortOnePayment,
  getPortOnePaymentFromResponse,
  getPortOnePaymentMethod,
  getPortOnePaymentTransactionNo,
} from '@/lib/payments/portone';
import { getPaymentPolicyMs } from '@/lib/payments/refunds';
import { createPostPaymentSplits } from '@/lib/payments/splits';
import {
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PAYMENT_TARGET_TYPE,
  PAYMENT_TYPE,
  REFUND_POLICY,
  SUBSCRIPTION_TYPE,
} from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type Body = {
  paymentKey?: string;
  paymentId?: string;
  orderId?: string;
  orderNo?: string;
  txId?: string;
  amount?: number;
  siteId?: string;
  postId?: string;
  guardianIdentityVerificationId?: string;
};

function isValidDonationAmount(value: number) {
  return Number.isInteger(value) && value >= 1000 && value <= 100000 && value % 1000 === 0;
}

async function insertFirstComeDrawIfNeeded({
  siteId,
  boardId,
  postId,
  commentId,
  userId,
  drawType,
  drawLimit,
}: {
  siteId: string;
  boardId: string;
  postId: string;
  commentId: string;
  userId: string;
  drawType: string | null;
  drawLimit: number | null;
}) {
  if (drawType !== 'first_come' || !drawLimit) return;

  const supabaseAdmin = getSupabaseAdmin();
  const existingResult = await supabaseAdmin
    .from('post_draws')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .limit(1);
  if (existingResult.error) throw new Error('추첨 정보를 확인하지 못했습니다.');
  if ((existingResult.data ?? []).length > 0) return;

  const drawCountResult = await supabaseAdmin
    .from('post_draws')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', postId);
  if (drawCountResult.error) throw new Error('추첨 정보를 확인하지 못했습니다.');
  const drawOrder = (drawCountResult.count ?? 0) + 1;
  if (drawOrder > drawLimit) return;

  const insertResult = await supabaseAdmin.from('post_draws').insert({
    site_id: siteId,
    board_id: boardId,
    post_id: postId,
    comment_id: commentId,
    user_id: userId,
    draw_order: drawOrder,
  });
  if (insertResult.error) throw new Error('추첨 정보를 저장하지 못했습니다.');
}

async function getStigmaId(value: string, errorMessage: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const normalized = normalizeText(value);
  const byId = normalized
    ? await supabaseAdmin.from('stigmas').select('id').eq('id', normalized).maybeSingle()
    : { data: null, error: null };
  if (!byId.error && byId.data?.id) return byId.data.id as string;
  const byUserId = normalized
    ? await supabaseAdmin.from('stigmas').select('id').eq('user_id', normalized).maybeSingle()
    : { data: null, error: null };
  if (!byUserId.error && byUserId.data?.id) return byUserId.data.id as string;
  throw new Error(errorMessage);
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession({ siteId: null });
    if (!session.authUserId || !session.stigmaId)
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const body = (await request.json()) as Body;
    const paymentKey = normalizeText(body.paymentId) || normalizeText(body.paymentKey);
    const orderNo = normalizeText(body.orderNo) || normalizeText(body.orderId);
    const siteId = normalizeText(body.siteId);
    const postId = normalizeText(body.postId);
    const amount = body.amount;
    if (!paymentKey || !orderNo || !siteId || !postId || typeof amount !== 'number' || !isValidDonationAmount(amount)) {
      return Response.json({ error: '후원 결제 정보가 올바르지 않습니다.' }, { status: 400 });
    }
    const supabaseAdmin = getSupabaseAdmin();
    const identityResult = await supabaseAdmin
      .from('chorogons')
      .select('birth_date, birth_date_dummy, identity_verified_at')
      .eq('user_id', session.stigmaId)
      .maybeSingle();
    if (!identityResult.data?.identity_verified_at)
      return Response.json({ error: '후원하려면 본인인증을 먼저 해주세요.' }, { status: 403 });
    if ((getKoreanAge(getChorogonBirthDate(identityResult.data)) ?? 0) < 12) {
      return Response.json({ error: '후원은 만 12세 이상부터 할 수 있습니다.' }, { status: 403 });
    }
    const minorControl = await enforceMinorPaymentControl(session.stigmaId, body.guardianIdentityVerificationId);
    if (minorControl.error)
      return Response.json({ error: minorControl.error, guardianAuthRequired: true }, { status: 403 });

    const order = assertReadyPaymentOrder(
      await getPaymentOrder(supabaseAdmin, { paymentKey, orderNo, buyerUserId: session.stigmaId }),
    );
    if (
      order.payment_type !== PAYMENT_TYPE.DONATION_POST ||
      order.target_type !== PAYMENT_TARGET_TYPE.POST ||
      order.site_id !== siteId ||
      order.target_id !== postId ||
      order.post_id !== postId ||
      order.amount !== amount
    ) {
      return Response.json({ error: '결제 주문 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    const [siteResult, postResult] = await Promise.all([
      supabaseAdmin.from('rhizomes').select('id, owner_id, is_shutdown').eq('id', siteId).maybeSingle(),
      supabaseAdmin
        .from('posts')
        .select(
          'id, site_id, board_id, user_id, series_id, published_status, is_closed, is_comment, draw_type, draw_limit',
        )
        .eq('id', postId)
        .eq('site_id', siteId)
        .maybeSingle(),
    ]);
    const site = siteResult.data;
    const post = postResult.data;
    if (
      siteResult.error ||
      !site ||
      site.is_shutdown ||
      postResult.error ||
      !post ||
      post.published_status !== 'published' ||
      post.is_closed ||
      post.is_comment === false ||
      !post.series_id
    ) {
      return Response.json({ error: '현재 후원 댓글을 작성할 수 없는 글입니다.' }, { status: 403 });
    }
    const [seriesResult, settingResult, purchaseResult] = await Promise.all([
      supabaseAdmin
        .from('board_series')
        .select('id, is_subscription')
        .eq('id', post.series_id)
        .eq('site_id', siteId)
        .eq('board_id', post.board_id)
        .maybeSingle(),
      supabaseAdmin
        .from('subscription_settings')
        .select('is_enabled')
        .eq('target_type', PAYMENT_TARGET_TYPE.SERIES)
        .eq('target_id', post.series_id)
        .eq('subscription_type', SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES)
        .maybeSingle(),
      supabaseAdmin
        .from('payments')
        .select('id')
        .eq('buyer_user_id', session.stigmaId)
        .eq('payment_type', PAYMENT_TYPE.PURCHASE_POST)
        .eq('target_type', PAYMENT_TARGET_TYPE.POST)
        .eq('target_id', post.id)
        .eq('status', PAYMENT_STATUS.PAID)
        .limit(1),
    ]);
    if (
      seriesResult.error ||
      !seriesResult.data?.is_subscription ||
      settingResult.error ||
      !settingResult.data?.is_enabled
    ) {
      return Response.json({ error: '구독이 연결된 연재 글만 후원할 수 있습니다.' }, { status: 403 });
    }
    const hasSubscription = await hasValidSeriesSubscription({
      supabaseAdmin,
      subscriberId: session.stigmaId,
      seriesId: post.series_id,
    });
    if (purchaseResult.error || (!hasSubscription && !(purchaseResult.data ?? []).length)) {
      return Response.json({ error: '구독 중이거나 구매한 글에서만 후원할 수 있습니다.' }, { status: 403 });
    }

    await assertCommunityCommentWritePolicy({
      siteId,
      stigmaId: session.stigmaId,
      sessionCase: session.case,
    });

    const existingResult = await supabaseAdmin
      .from('payments')
      .select('id, amount')
      .eq('payment_key', paymentKey)
      .maybeSingle();
    if (existingResult.error) throw new Error('결제 정보를 확인하지 못했습니다.');
    let paymentId = existingResult.data?.id as string | undefined;
    if (!paymentId) {
      const payment = getPortOnePaymentFromResponse(await getPortOnePayment(paymentKey));
      assertPortOnePaidPayment(payment);
      if (getPortOnePaidAmount(payment) !== amount || normalizeText(payment.id) !== paymentKey) {
        return Response.json({ error: '결제 승인 정보가 올바르지 않습니다.' }, { status: 400 });
      }
      const approvedAt = getPortOnePaidAt(payment) || new Date().toISOString();
      const insertResult = await supabaseAdmin
        .from('payments')
        .insert({
          provider: getCurrentPortOneProvider(),
          payment_key: paymentKey,
          order_no: orderNo,
          tx_no: normalizeText(body.txId) || null,
          transaction_no: getPortOnePaymentTransactionNo(payment) || null,
          buyer_user_id: session.stigmaId,
          amount,
          refunded_amount: 0,
          currency: payment.amount?.currency || 'KRW',
          status: PAYMENT_STATUS.PAID,
          payment_method: getPortOnePaymentMethod(payment) || PAYMENT_METHOD.CARD,
          payment_type: PAYMENT_TYPE.DONATION_POST,
          target_type: PAYMENT_TARGET_TYPE.POST,
          target_id: post.id,
          post_payment: { site_id: siteId, board_id: post.board_id, series_id: post.series_id, post_id: post.id },
          subscription_id: null,
          failure_code: null,
          failure_message: null,
          failure_stage: null,
          refund_policy: REFUND_POLICY.SEVEN_DAYS,
          refundable_until: new Date(new Date(approvedAt).getTime() + getPaymentPolicyMs()).toISOString(),
          approved_at: approvedAt,
          refunded_at: null,
          raw_data: payment,
          guardian_identity_verified: Boolean(minorControl.guardianIdentityVerificationId),
          guardian_identity_verified_at: minorControl.guardianIdentityVerificationId ? approvedAt : null,
          guardian_identity_verification_id: minorControl.guardianIdentityVerificationId,
        })
        .select('id')
        .single();
      if (insertResult.error || !insertResult.data) throw new Error('후원 결제 내역을 저장하지 못했습니다.');
      paymentId = insertResult.data.id as string;
    }

    const [siteOwnerStigmaId, postAuthorStigmaId] = await Promise.all([
      getStigmaId(site.owner_id as string, '사이트 오너 정보를 확인하지 못했습니다.'),
      getStigmaId(post.user_id as string, '글 작성자 정보를 확인하지 못했습니다.'),
    ]);
    await createPostPaymentSplits({
      supabaseAdmin,
      paymentId,
      siteId,
      boardId: post.board_id,
      seriesId: post.series_id,
      postId: post.id,
      siteOwnerStigmaId,
      postAuthorStigmaId,
      amount,
    });
    const commentResult = await supabaseAdmin
      .from('post_comments')
      .select('id')
      .eq('donation_payment_id', paymentId)
      .maybeSingle();
    if (commentResult.error) throw new Error('후원 댓글을 확인하지 못했습니다.');
    if (!commentResult.data) {
      const insertCommentResult = await supabaseAdmin
        .from('post_comments')
        .insert({
          site_id: siteId,
          board_id: post.board_id,
          post_id: post.id,
          user_id: session.stigmaId,
          parent_id: null,
          reply_to_id: null,
          content: normalizeText(order.donation_comment_content) || null,
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
          is_blinded: false,
          blinded_at: null,
          blinded_by: null,
          blinded_message: null,
          is_locked: false,
          is_pinned: false,
          donation_payment_id: paymentId,
          donation_amount: amount,
        })
        .select('id')
        .single();
      if (insertCommentResult.error || !insertCommentResult.data) throw new Error('후원 댓글을 등록하지 못했습니다.');

      await insertFirstComeDrawIfNeeded({
        siteId,
        boardId: post.board_id,
        postId: post.id,
        commentId: insertCommentResult.data.id,
        userId: session.stigmaId,
        drawType: typeof post.draw_type === 'string' ? post.draw_type : null,
        drawLimit: typeof post.draw_limit === 'number' ? post.draw_limit : null,
      });

      await increaseCommunityCommentCount({ siteId, stigmaId: session.stigmaId });

      const membershipResult = await supabaseAdmin
        .from('rhizome_stigmas')
        .select('id')
        .eq('site_id', siteId)
        .eq('user_id', session.stigmaId)
        .maybeSingle();
      if (membershipResult.data) {
        await refreshCommunityMemberLevel({ supabaseAdmin, siteId, membershipId: membershipResult.data.id });
      }

      if (post.user_id !== session.stigmaId) {
        const notificationResult = await supabaseAdmin.from('notifications').insert({
          user_id: post.user_id,
          send_user_id: session.stigmaId,
          send_site_id: siteId,
          send_board_id: post.board_id,
          send_series_id: post.series_id,
          send_post_id: post.id,
          notification_type: NOTIFICATION_TYPE.POST_COMMENTED,
          is_read: false,
        });
        if (notificationResult.error)
          console.error('[donation/post] notification insert error', notificationResult.error);
      }
    }
    await completePaymentOrder(supabaseAdmin, order.id);
    return Response.json({ ok: true, paymentId });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message || '후원 결제를 완료하지 못했습니다.'
            : '후원 결제를 완료하지 못했습니다.',
      },
      { status: 500 },
    );
  }
}
