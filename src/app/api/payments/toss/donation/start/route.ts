import { NextRequest } from 'next/server';
import { createPaymentOrderNo } from '@/lib/payments/orderNo';
import { getTossClientKey } from '@/lib/payments/toss';
import { PAYMENT_TARGET_TYPE, PAYMENT_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type DonationTargetType = 'site' | 'post';

type DonationStartBody = {
  siteName?: string;
  targetType?: DonationTargetType;
  boardName?: string;
  contentId?: string;
  amount?: number;
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
};

type PostRow = {
  id: string;
  slug: number;
  subject: string;
  site_id: string;
  board_id: string;
  series_id: string;
  published_status: string;
  is_closed: boolean;
};

type SeriesRow = {
  id: string;
  is_subscription: boolean | null;
};

type DonationTarget =
  | {
      targetType: 'site';
      paymentType: typeof PAYMENT_TYPE.DONATION_SITE;
      paymentTargetType: typeof PAYMENT_TARGET_TYPE.SITE;
      site: SiteRow;
      board: null;
      post: null;
      orderName: string;
    }
  | {
      targetType: 'post';
      paymentType: typeof PAYMENT_TYPE.DONATION_POST;
      paymentTargetType: typeof PAYMENT_TARGET_TYPE.POST;
      site: SiteRow;
      board: BoardRow;
      post: PostRow;
      orderName: string;
    };

function isDonationTargetType(value: string): value is DonationTargetType {
  return value === 'site' || value === 'post';
}

function isNumericSlug(value: string) {
  return /^\d+$/.test(value);
}

function createOrderNo(targetType: DonationTargetType) {
  return createPaymentOrderNo(targetType === 'post' ? 'POST_DONATION' : 'SITE_DONATION');
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

async function getSiteByName(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_label, is_shutdown')
    .eq('site_key', siteName)
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

async function getBoardByName({ siteId, boardName }: { siteId: string; boardName: string }) {
  const supabaseAdmin = getSupabaseAdmin();

  const boardResult = await supabaseAdmin
    .from('boards')
    .select('id, board_key, board_label')
    .eq('site_id', siteId)
    .eq('board_key', boardName)
    .maybeSingle();

  if (boardResult.error) {
    console.error(boardResult.error);

    throw new Error('게시판 정보를 불러오지 못했습니다.');
  }

  if (!boardResult.data) {
    throw new Error('게시판 정보를 찾을 수 없습니다.');
  }

  return boardResult.data as BoardRow;
}

async function getPostBySlug({ siteId, boardId, contentId }: { siteId: string; boardId: string; contentId: string }) {
  const supabaseAdmin = getSupabaseAdmin();

  if (!contentId || !isNumericSlug(contentId)) {
    throw new Error('contentId가 유효하지 않습니다.');
  }

  const postResult = await supabaseAdmin
    .from('posts')
    .select('id, slug, subject, site_id, board_id, series_id, published_status, is_closed')
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .eq('slug', Number(contentId))
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

async function getSeriesById({ siteId, boardId, seriesId }: { siteId: string; boardId: string; seriesId: string }) {
  const supabaseAdmin = getSupabaseAdmin();

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

async function getBoardSeriesCount({ siteId, boardId }: { siteId: string; boardId: string }) {
  const supabaseAdmin = getSupabaseAdmin();

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

async function getDonationTarget({
  siteName,
  targetType,
  boardName,
  contentId,
}: {
  siteName: string;
  targetType: DonationTargetType;
  boardName: string;
  contentId: string;
}): Promise<DonationTarget> {
  const site = await getSiteByName(siteName);

  if (targetType === 'site') {
    return {
      targetType: 'site',
      paymentType: PAYMENT_TYPE.DONATION_SITE,
      paymentTargetType: PAYMENT_TARGET_TYPE.SITE,
      site,
      board: null,
      post: null,
      orderName: `${site.site_label || site.site_key} 후원`,
    };
  }

  if (!boardName) {
    throw new Error('boardName이 유효하지 않습니다.');
  }

  if (!contentId) {
    throw new Error('contentId가 유효하지 않습니다.');
  }

  const board = await getBoardByName({
    siteId: site.id,
    boardName,
  });

  const seriesCount = await getBoardSeriesCount({
    siteId: site.id,
    boardId: board.id,
  });

  if (seriesCount < 2) {
    throw new Error('연재가 2개 이상 있는 게시판의 연재 글만 후원할 수 있습니다.');
  }

  const post = await getPostBySlug({
    siteId: site.id,
    boardId: board.id,
    contentId,
  });

  const series = await getSeriesById({
    siteId: site.id,
    boardId: board.id,
    seriesId: post.series_id,
  });

  if (series.is_subscription === true) {
    throw new Error('구독 설정된 연재 글은 후원 대신 구매할 수 있습니다.');
  }

  return {
    targetType: 'post',
    paymentType: PAYMENT_TYPE.DONATION_POST,
    paymentTargetType: PAYMENT_TARGET_TYPE.POST,
    site,
    board,
    post,
    orderName: `${post.subject} 후원`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = (await request.json()) as DonationStartBody;
    const siteName = normalizeText(body.siteName).toLowerCase();
    const targetTypeValue = normalizeText(body.targetType).toLowerCase();
    const targetType = isDonationTargetType(targetTypeValue) ? targetTypeValue : 'site';
    const boardName = normalizeText(body.boardName).toLowerCase();
    const contentId = normalizeText(body.contentId);
    const amount = body.amount;

    if (!siteName) {
      return Response.json({ error: '사이트 정보가 없습니다.' }, { status: 400 });
    }

    if (typeof amount !== 'number' || !validateDonationAmount(amount)) {
      return Response.json(
        {
          error: '후원금액은 1,000원부터 100,000원까지 1,000원 단위로 입력해 주세요.',
        },
        { status: 400 },
      );
    }

    const target = await getDonationTarget({
      siteName,
      targetType,
      boardName,
      contentId,
    });

    const orderNo = createOrderNo(target.targetType);
    const successUrl = getSafeRedirectUrl(request, body.successUrl);
    const failUrl = getSafeRedirectUrl(request, body.failUrl);

    successUrl.searchParams.set('siteId', target.site.id);
    successUrl.searchParams.set('orderNo', orderNo);
    successUrl.searchParams.set('paymentType', target.paymentType);
    successUrl.searchParams.set('targetType', target.paymentTargetType);
    successUrl.searchParams.set('amount', String(amount));

    failUrl.searchParams.set('siteId', target.site.id);
    failUrl.searchParams.set('orderNo', orderNo);
    failUrl.searchParams.set('paymentType', target.paymentType);
    failUrl.searchParams.set('targetType', target.paymentTargetType);
    failUrl.searchParams.set('amount', String(amount));

    if (target.targetType === 'post') {
      successUrl.searchParams.set('boardId', target.board.id);
      successUrl.searchParams.set('seriesId', target.post.series_id);
      successUrl.searchParams.set('postId', target.post.id);
      successUrl.searchParams.set('boardName', target.board.board_key);
      successUrl.searchParams.set('contentId', String(target.post.slug));

      failUrl.searchParams.set('boardId', target.board.id);
      failUrl.searchParams.set('seriesId', target.post.series_id);
      failUrl.searchParams.set('postId', target.post.id);
      failUrl.searchParams.set('boardName', target.board.board_key);
      failUrl.searchParams.set('contentId', String(target.post.slug));
    }

    return Response.json({
      clientKey: getTossClientKey(),
      orderNo,
      orderName: target.orderName,
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
