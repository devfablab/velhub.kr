import { NextRequest } from 'next/server';
import { assertCommunityCommentWritePolicy } from '@/lib/community/policies';
import { getKoreanAge } from '@/lib/identity/age';
import { getChorogonBirthDate } from '@/lib/identity/chorogon';
import { hasValidSeriesSubscription } from '@/lib/payments/blogDonation';
import { getPaymentCustomerName, getPaymentCustomerPhone, getPaymentCustomerRealName } from '@/lib/payments/customer';
import { enforceMinorPaymentControl } from '@/lib/payments/minorPaymentControl';
import { createPaymentOrderNo } from '@/lib/payments/orderNo';
import { createPaymentOrder } from '@/lib/payments/paymentOrder';
import { createPortOnePaymentKey, getPortOneKpnGeneralChannelKey, getPortOneStoreId } from '@/lib/payments/portone';
import { PAYMENT_STATUS, PAYMENT_TARGET_TYPE, PAYMENT_TYPE, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type Body = {
  siteName?: string;
  boardName?: string;
  contentId?: string;
  commentContent?: string;
  amount?: number;
  successUrl?: string;
  failUrl?: string;
  guardianIdentityVerificationId?: string;
};

function isNumericSlug(value: string) {
  return /^\d+$/.test(value);
}

function isValidDonationAmount(value: number) {
  return Number.isInteger(value) && value >= 1000 && value <= 100000 && value % 1000 === 0;
}

function getSafeRedirectUrl(request: NextRequest, value: string | undefined) {
  if (!value) throw new Error('이동할 주소가 없습니다.');
  const url = new URL(value, request.nextUrl.origin);
  if (url.origin !== request.nextUrl.origin) throw new Error('이동할 주소가 올바르지 않습니다.');
  return url;
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession({ siteId: null });
    if (!session.authUserId || !session.stigmaId)
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    const body = (await request.json()) as Body;
    const siteName = normalizeText(body.siteName).toLowerCase();
    const boardName = normalizeText(body.boardName).toLowerCase();
    const contentId = normalizeText(body.contentId);
    const commentContent = normalizeText(body.commentContent);
    const amount = body.amount;

    if (!siteName || !boardName || !contentId) {
      return Response.json({ error: '후원할 글 정보가 올바르지 않습니다.' }, { status: 400 });
    }
    if (typeof amount !== 'number' || !isValidDonationAmount(amount)) {
      return Response.json(
        { error: '후원금액은 1,000원부터 100,000원까지 1,000원 단위로 입력해 주세요.' },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const [paymentEmail, paymentPhone, customerName, identityResult] = await Promise.all([
      getPaymentCustomerName(session.authUserId),
      getPaymentCustomerPhone(session.authUserId),
      getPaymentCustomerRealName(session.authUserId),
      supabaseAdmin
        .from('chorogons')
        .select('birth_date, birth_date_dummy, identity_verified_at')
        .eq('user_id', session.stigmaId)
        .maybeSingle(),
    ]);
    if (!customerName || !paymentEmail || !paymentPhone || !identityResult.data?.identity_verified_at) {
      return Response.json({ error: '후원하려면 본인인증을 먼저 해주세요.' }, { status: 403 });
    }
    if ((getKoreanAge(getChorogonBirthDate(identityResult.data)) ?? 0) < 12) {
      return Response.json({ error: '후원은 만 12세 이상부터 할 수 있습니다.' }, { status: 403 });
    }

    const minorControl = await enforceMinorPaymentControl(session.stigmaId, body.guardianIdentityVerificationId);
    if (minorControl.error)
      return Response.json({ error: minorControl.error, guardianAuthRequired: true }, { status: 403 });

    const siteResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label, site_type, is_shutdown')
      .eq('site_key', siteName)
      .maybeSingle();
    const site = siteResult.data;
    if (siteResult.error || !site || site.is_shutdown)
      return Response.json({ error: '현재 후원할 수 없는 사이트입니다.' }, { status: 403 });

    const boardResult = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, is_active')
      .eq('site_id', site.id)
      .eq('board_key', boardName)
      .maybeSingle();
    const board = boardResult.data;
    if (boardResult.error || !board || !board.is_active || board.board_type === 'page') {
      return Response.json({ error: '현재 후원할 수 없는 게시판입니다.' }, { status: 403 });
    }
    if (site.site_type === 'community' && !['basic', 'gallery'].includes(board.board_type)) {
      return Response.json(
        { error: '커뮤니티는 일반 또는 갤러리 게시판의 연재 글만 후원할 수 있습니다.' },
        { status: 403 },
      );
    }

    const postQuery = supabaseAdmin
      .from('posts')
      .select('id, slug, subject, site_id, board_id, series_id, published_status, is_closed, is_comment')
      .eq('site_id', site.id)
      .eq('board_id', board.id);
    const postResult = isNumericSlug(contentId)
      ? await postQuery.eq('slug', contentId).maybeSingle()
      : await postQuery.eq('id', contentId).maybeSingle();
    const post = postResult.data;
    if (
      postResult.error ||
      !post ||
      post.published_status !== 'published' ||
      post.is_closed ||
      post.is_comment === false
    ) {
      return Response.json({ error: '현재 후원 댓글을 작성할 수 없는 글입니다.' }, { status: 403 });
    }
    if (!post.series_id) return Response.json({ error: '구독 연재 글만 후원할 수 있습니다.' }, { status: 403 });

    const [seriesResult, settingResult] = await Promise.all([
      supabaseAdmin
        .from('board_series')
        .select('id, series_label, is_subscription')
        .eq('site_id', site.id)
        .eq('board_id', board.id)
        .eq('id', post.series_id)
        .maybeSingle(),
      supabaseAdmin
        .from('subscription_settings')
        .select('id, is_enabled')
        .eq('target_type', PAYMENT_TARGET_TYPE.SERIES)
        .eq('target_id', post.series_id)
        .eq('subscription_type', SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES)
        .maybeSingle(),
    ]);
    if (
      seriesResult.error ||
      !seriesResult.data ||
      seriesResult.data.is_subscription !== true ||
      settingResult.error ||
      !settingResult.data?.is_enabled
    ) {
      return Response.json({ error: '구독이 연결된 연재 글만 후원할 수 있습니다.' }, { status: 403 });
    }

    const [hasSubscription, purchaseResult] = await Promise.all([
      hasValidSeriesSubscription({ supabaseAdmin, subscriberId: session.stigmaId, seriesId: post.series_id }),
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
    if (purchaseResult.error) return Response.json({ error: '글 구매 내역을 확인하지 못했습니다.' }, { status: 500 });
    if (!hasSubscription && !(purchaseResult.data ?? []).length) {
      return Response.json({ error: '구독 중이거나 구매한 글에서만 후원할 수 있습니다.' }, { status: 403 });
    }

    await assertCommunityCommentWritePolicy({
      siteId: site.id,
      stigmaId: session.stigmaId,
      sessionCase: session.case,
    });

    const orderNo = createPaymentOrderNo('DONATION_POST');
    const paymentId = createPortOnePaymentKey(orderNo);
    await createPaymentOrder(supabaseAdmin, {
      payment_key: paymentId,
      order_no: orderNo,
      buyer_user_id: session.stigmaId,
      payment_type: PAYMENT_TYPE.DONATION_POST,
      target_type: PAYMENT_TARGET_TYPE.POST,
      target_id: post.id,
      site_id: site.id,
      board_id: board.id,
      series_id: post.series_id,
      post_id: post.id,
      donation_comment_content: commentContent || null,
      amount,
      currency: 'KRW',
    });

    const successUrl = getSafeRedirectUrl(request, body.successUrl);
    const failUrl = getSafeRedirectUrl(request, body.failUrl);
    for (const url of [successUrl, failUrl]) {
      url.searchParams.set('paymentType', PAYMENT_TYPE.DONATION_POST);
      url.searchParams.set('targetType', PAYMENT_TARGET_TYPE.POST);
      url.searchParams.set('siteId', site.id);
      url.searchParams.set('boardId', board.id);
      url.searchParams.set('seriesId', post.series_id);
      url.searchParams.set('postId', post.id);
      url.searchParams.set('boardName', board.board_key);
      url.searchParams.set('contentId', String(post.slug));
      url.searchParams.set('orderNo', orderNo);
      url.searchParams.set('paymentId', paymentId);
      url.searchParams.set('amount', String(amount));
    }
    if (minorControl.guardianIdentityVerificationId) {
      successUrl.searchParams.set('guardianIdentityVerificationId', minorControl.guardianIdentityVerificationId);
    }

    return Response.json({
      storeId: getPortOneStoreId(),
      channelKey: getPortOneKpnGeneralChannelKey(),
      orderNo,
      paymentId,
      orderName: `${post.subject} 후원`,
      amount,
      customerName,
      paymentEmail,
      paymentPhone,
      redirectUrl: successUrl.toString(),
      failUrl: failUrl.toString(),
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message || '후원을 시작하지 못했습니다.' : '후원을 시작하지 못했습니다.',
      },
      { status: 500 },
    );
  }
}
