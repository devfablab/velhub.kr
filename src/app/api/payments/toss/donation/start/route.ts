import { NextRequest } from 'next/server';
import { createPaymentOrderNo } from '@/lib/payments/orderNo';
import { getTossClientKey } from '@/lib/payments/toss';
import { PAYMENT_TARGET_TYPE, PAYMENT_TYPE, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type DonationTargetType = 'site' | 'post';

type DonationStartBody = {
  targetType?: DonationTargetType;
  siteName?: string;
  boardName?: string;
  contentId?: string;
  amount?: number;
  successUrl?: string;
  failUrl?: string;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  site_type: string;
  is_shutdown: boolean;
};

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string | null;
  board_type: string;
};

type PostRow = {
  id: string;
  slug: number | string;
  subject: string | null;
  site_id: string;
  board_id: string;
  user_id: string;
  series_id: string | null;
  published_status: string;
  is_closed: boolean;
};

type SeriesSubscriptionSettingRow = {
  id: string;
  is_enabled: boolean;
};

function createOrderNo(targetType: DonationTargetType) {
  if (targetType === 'post') {
    return createPaymentOrderNo('POST_DONATION');
  }

  return createPaymentOrderNo('SITE_DONATION');
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

function normalizeDonationTargetType(value: string | null | undefined): DonationTargetType {
  return value === 'post' ? 'post' : 'site';
}

function isNumericSlug(value: string) {
  return /^\d+$/.test(value);
}

async function getSite({ siteName }: { siteName: string }) {
  const supabaseAdmin = getSupabaseAdmin();

  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_label, site_type, is_shutdown')
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
    throw new Error('현재 후원할 수 없는 사이트입니다.');
  }

  return site;
}

async function getPostDonationTarget({
  siteId,
  boardName,
  contentId,
}: {
  siteId: string;
  boardName: string;
  contentId: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();

  if (!boardName) {
    throw new Error('boardName이 유효하지 않습니다.');
  }

  if (!contentId || !isNumericSlug(contentId)) {
    throw new Error('contentId가 유효하지 않습니다.');
  }

  const boardResult = await supabaseAdmin
    .from('boards')
    .select('id, board_key, board_label, board_type')
    .eq('site_id', siteId)
    .eq('board_key', boardName)
    .maybeSingle();

  if (boardResult.error) {
    throw new Error('게시판 정보를 불러오지 못했습니다.');
  }

  if (!boardResult.data) {
    throw new Error('게시판 정보를 찾을 수 없습니다.');
  }

  const board = boardResult.data as BoardRow;

  const postResult = await supabaseAdmin
    .from('posts')
    .select('id, slug, subject, site_id, board_id, user_id, series_id, published_status, is_closed')
    .eq('site_id', siteId)
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
    throw new Error('공개된 글만 후원할 수 있습니다.');
  }

  if (post.is_closed) {
    throw new Error('현재 후원할 수 없는 글입니다.');
  }

  if (!post.series_id) {
    throw new Error('연재 글만 후원할 수 있습니다.');
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

  return {
    board,
    post,
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = (await request.json()) as DonationStartBody;
    const targetType = normalizeDonationTargetType(body.targetType);
    const siteName = normalizeText(body.siteName).toLowerCase();
    const boardName = normalizeText(body.boardName).toLowerCase();
    const contentId = normalizeText(body.contentId);
    const amount = body.amount;

    if (!siteName) {
      return Response.json({ error: '사이트 정보가 없습니다.' }, { status: 400 });
    }

    if (typeof amount !== 'number' || !validateDonationAmount(amount)) {
      return Response.json(
        { error: '후원금액은 1,000원부터 100,000원까지 1,000원 단위로 입력해 주세요.' },
        { status: 400 },
      );
    }

    const site = await getSite({
      siteName,
    });

    const orderNo = createOrderNo(targetType);
    const successUrl = getSafeRedirectUrl(request, body.successUrl);
    const failUrl = getSafeRedirectUrl(request, body.failUrl);

    successUrl.searchParams.set('targetType', targetType);
    successUrl.searchParams.set('siteId', site.id);
    successUrl.searchParams.set('orderNo', orderNo);

    failUrl.searchParams.set('targetType', targetType);
    failUrl.searchParams.set('siteId', site.id);
    failUrl.searchParams.set('orderNo', orderNo);
    failUrl.searchParams.set('amount', String(amount));

    if (targetType === 'post') {
      const { board, post } = await getPostDonationTarget({
        siteId: site.id,
        boardName,
        contentId,
      });

      successUrl.searchParams.set('boardId', board.id);
      successUrl.searchParams.set('postId', post.id);
      successUrl.searchParams.set('boardName', board.board_key);
      successUrl.searchParams.set('contentId', String(post.slug));

      failUrl.searchParams.set('boardId', board.id);
      failUrl.searchParams.set('postId', post.id);
      failUrl.searchParams.set('boardName', board.board_key);
      failUrl.searchParams.set('contentId', String(post.slug));
      failUrl.searchParams.set('paymentType', PAYMENT_TYPE.DONATION_POST);
      failUrl.searchParams.set('targetType', PAYMENT_TARGET_TYPE.POST);

      return Response.json({
        clientKey: getTossClientKey(),
        orderNo,
        orderName: `${post.subject ?? '글'} 후원`,
        amount,
        successUrl: successUrl.toString(),
        failUrl: failUrl.toString(),
      });
    }

    successUrl.searchParams.set('targetType', PAYMENT_TARGET_TYPE.SITE);

    failUrl.searchParams.set('paymentType', PAYMENT_TYPE.DONATION_SITE);
    failUrl.searchParams.set('targetType', PAYMENT_TARGET_TYPE.SITE);

    return Response.json({
      clientKey: getTossClientKey(),
      orderNo,
      orderName: `${site.site_label ?? site.site_key} 후원`,
      amount,
      successUrl: successUrl.toString(),
      failUrl: failUrl.toString(),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '후원을 시작하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '후원을 시작하지 못했습니다.' }, { status: 500 });
  }
}
