import { NextRequest } from 'next/server';
import { createPaymentOrderNo } from '@/lib/payments/orderNo';
import { getTossClientKey } from '@/lib/payments/toss';
import { PAYMENT_STATUS, PAYMENT_TARGET_TYPE, PAYMENT_TYPE, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type PostPurchaseStartBody = {
  siteName?: string;
  boardName?: string;
  contentId?: string;
  successUrl?: string;
  failUrl?: string;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string;
  is_shutdown: boolean;
};

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: string;
};

type PostRow = {
  id: string;
  slug: number;
  subject: string;
  site_id: string;
  board_id: string;
  user_id: string;
  series_id: string;
  published_status: string;
  is_closed: boolean;
};

type SubscriptionSettingRow = {
  id: string;
  price: number;
  is_enabled: boolean;
};

type ExistingPaymentRow = {
  id: string;
};

function isNumericSlug(value: string) {
  return /^\d+$/.test(value);
}

function getPostPurchasePrice(seriesSubscriptionPrice: number) {
  return Math.floor((seriesSubscriptionPrice * 27) / 100 / 1000) * 1000;
}

function getSafeRedirectUrl(request: NextRequest, url: string | undefined) {
  if (!url) {
    throw new Error('이동할 주소가 없습니다.');
  }

  const parsedUrl = new URL(url, request.nextUrl.origin);

  if (parsedUrl.origin !== request.nextUrl.origin) {
    throw new Error('이동할 주소가 올바르지 않습니다.');
  }

  return parsedUrl;
}

async function getPurchaseTarget({
  siteName,
  boardName,
  contentId,
}: {
  siteName: string;
  boardName: string;
  contentId: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();

  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_label, is_shutdown')
    .eq('site_key', siteName)
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

  const boardResult = await supabaseAdmin
    .from('boards')
    .select('id, board_key, board_label, board_type')
    .eq('site_id', site.id)
    .eq('board_key', boardName)
    .maybeSingle();

  if (boardResult.error) {
    throw new Error('게시판 정보를 불러오지 못했습니다.');
  }

  if (!boardResult.data) {
    throw new Error('게시판 정보를 찾을 수 없습니다.');
  }

  const board = boardResult.data as BoardRow;

  if (!contentId || !isNumericSlug(contentId)) {
    throw new Error('contentId가 유효하지 않습니다.');
  }

  const postResult = await supabaseAdmin
    .from('posts')
    .select('id, slug, subject, site_id, board_id, user_id, series_id, published_status, is_closed')
    .eq('site_id', site.id)
    .eq('board_id', board.id)
    .eq('slug', Number(contentId))
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

  const subscriptionSettingResult = await supabaseAdmin
    .from('subscription_settings')
    .select('id, price, is_enabled')
    .eq('target_type', PAYMENT_TARGET_TYPE.SERIES)
    .eq('target_id', post.series_id)
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

  const postPurchasePrice = getPostPurchasePrice(subscriptionSetting.price);

  if (postPurchasePrice < 1000) {
    throw new Error('포스팅 구매 금액이 1,000원 미만입니다.');
  }

  return {
    site,
    board,
    post,
    postPurchasePrice,
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = (await request.json()) as PostPurchaseStartBody;
    const siteName = normalizeText(body.siteName).toLowerCase();
    const boardName = normalizeText(body.boardName).toLowerCase();
    const contentId = normalizeText(body.contentId);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!boardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!contentId) {
      return Response.json({ error: 'contentId가 유효하지 않습니다.' }, { status: 400 });
    }

    const { site, board, post, postPurchasePrice } = await getPurchaseTarget({
      siteName,
      boardName,
      contentId,
    });

    const supabaseAdmin = getSupabaseAdmin();

    const existingPurchaseResult = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('buyer_user_id', session.authUserId)
      .eq('payment_type', PAYMENT_TYPE.POST_PURCHASE)
      .eq('target_type', PAYMENT_TARGET_TYPE.POST)
      .eq('target_id', post.id)
      .eq('status', PAYMENT_STATUS.PAID)
      .maybeSingle();

    if (existingPurchaseResult.error) {
      console.error(existingPurchaseResult.error);

      return Response.json({ error: '구매 내역을 확인하지 못했습니다.' }, { status: 500 });
    }

    if (existingPurchaseResult.data) {
      const existingPurchase = existingPurchaseResult.data as ExistingPaymentRow;

      return Response.json({
        ok: true,
        alreadyPurchased: true,
        paymentId: existingPurchase.id,
      });
    }

    const orderNo = createPaymentOrderNo('POST_PURCHASE');
    const successUrl = getSafeRedirectUrl(request, body.successUrl);
    const failUrl = getSafeRedirectUrl(request, body.failUrl);

    successUrl.searchParams.set('paymentType', PAYMENT_TYPE.POST_PURCHASE);
    successUrl.searchParams.set('targetType', PAYMENT_TARGET_TYPE.POST);
    successUrl.searchParams.set('siteId', site.id);
    successUrl.searchParams.set('boardId', board.id);
    successUrl.searchParams.set('seriesId', post.series_id);
    successUrl.searchParams.set('postId', post.id);
    successUrl.searchParams.set('boardName', board.board_key);
    successUrl.searchParams.set('contentId', String(post.slug));
    successUrl.searchParams.set('orderNo', orderNo);

    failUrl.searchParams.set('paymentType', PAYMENT_TYPE.POST_PURCHASE);
    failUrl.searchParams.set('targetType', PAYMENT_TARGET_TYPE.POST);
    failUrl.searchParams.set('siteId', site.id);
    failUrl.searchParams.set('boardId', board.id);
    failUrl.searchParams.set('seriesId', post.series_id);
    failUrl.searchParams.set('postId', post.id);
    failUrl.searchParams.set('boardName', board.board_key);
    failUrl.searchParams.set('contentId', String(post.slug));
    failUrl.searchParams.set('orderNo', orderNo);
    failUrl.searchParams.set('amount', String(postPurchasePrice));

    return Response.json({
      clientKey: getTossClientKey(),
      orderNo,
      orderName: `${post.subject} 구매`,
      amount: postPurchasePrice,
      successUrl: successUrl.toString(),
      failUrl: failUrl.toString(),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '포스팅 구매를 시작하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '포스팅 구매를 시작하지 못했습니다.' }, { status: 500 });
  }
}
