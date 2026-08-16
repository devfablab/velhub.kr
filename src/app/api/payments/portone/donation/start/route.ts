import { NextRequest } from 'next/server';
import { enforceMinorPaymentControl } from '@/lib/payments/minorPaymentControl';
import { createPaymentOrderNo } from '@/lib/payments/orderNo';
import { createPortOnePaymentKey, getPortOneKpnGeneralChannelKey, getPortOneStoreId } from '@/lib/payments/portone';
import { PAYMENT_TARGET_TYPE, PAYMENT_TYPE, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type DonationTargetType = 'site' | 'series';

type DonationStartBody = {
  siteName?: string;
  targetType?: DonationTargetType;
  boardName?: string;
  seriesName?: string;
  amount?: number;
  successUrl?: string;
  failUrl?: string;
  guardianIdentityVerificationId?: string;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string;
  site_type: string;
  is_shutdown: boolean;
};

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: string;
  is_active: boolean;
};

type SeriesRow = {
  id: string;
  series_key: string;
  series_label: string;
};

type DonationTarget =
  | {
      targetType: 'site';
      paymentType: typeof PAYMENT_TYPE.DONATION_SITE;
      paymentTargetType: typeof PAYMENT_TARGET_TYPE.SITE;
      site: SiteRow;
      board: null;
      series: null;
      orderName: string;
    }
  | {
      targetType: 'series';
      paymentType: typeof PAYMENT_TYPE.DONATION_SERIES;
      paymentTargetType: typeof PAYMENT_TARGET_TYPE.SERIES;
      site: SiteRow;
      board: BoardRow;
      series: SeriesRow;
      orderName: string;
    };

function isDonationTargetType(value: string): value is DonationTargetType {
  return value === 'site' || value === 'series';
}

function createOrderNo(targetType: DonationTargetType) {
  if (targetType === 'series') {
    return createPaymentOrderNo('DONATION_SERIES');
  }

  return createPaymentOrderNo('DONATION_SITE');
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
    .select('id, site_key, site_label, site_type, is_shutdown')
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
    .select('id, board_key, board_label, board_type, is_active')
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

  const board = boardResult.data as BoardRow;

  if (!board.is_active) {
    throw new Error('현재 후원할 수 없는 게시판입니다.');
  }

  if (board.board_type === 'page') {
    throw new Error('페이지 게시판은 후원할 수 없습니다.');
  }

  return board;
}

async function getSeriesByName({
  siteId,
  boardId,
  seriesName,
}: {
  siteId: string;
  boardId: string;
  seriesName: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();

  const seriesResult = await supabaseAdmin
    .from('board_series')
    .select('id, series_key, series_label')
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .eq('series_key', seriesName)
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

async function validateSiteDonationTarget(site: SiteRow) {
  const supabaseAdmin = getSupabaseAdmin();

  if (site.site_type !== 'blog') {
    throw new Error('블로그 후원은 블로그에서만 가능합니다.');
  }

  const blogResult = await supabaseAdmin.from('blogs').select('blog_type').eq('site_id', site.id).maybeSingle();

  if (blogResult.data?.blog_type === 'team') {
    throw new Error('팀 블로그는 블로그 후원을 받을 수 없습니다.');
  }

  const seriesCountResult = await supabaseAdmin
    .from('board_series')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', site.id);

  if (seriesCountResult.error) {
    console.error(seriesCountResult.error);

    throw new Error('블로그 연재 개수를 확인하지 못했습니다.');
  }

  if ((seriesCountResult.count ?? 0) < 2) {
    throw new Error('블로그 후원은 연재가 2개 이상 있는 블로그에서만 가능합니다.');
  }

  const membershipSettingResult = await supabaseAdmin
    .from('subscription_settings')
    .select('id, is_enabled')
    .eq('target_type', PAYMENT_TARGET_TYPE.SITE)
    .eq('target_id', site.id)
    .eq('subscription_type', SUBSCRIPTION_TYPE.MEMBERSHIP_BLOG)
    .maybeSingle();

  if (membershipSettingResult.error) {
    console.error(membershipSettingResult.error);

    throw new Error('블로그 멤버십 설정을 확인하지 못했습니다.');
  }

  if (membershipSettingResult.data?.is_enabled) {
    throw new Error('블로그 멤버십이 설정된 블로그는 블로그 후원을 사용할 수 없습니다.');
  }
}

async function getDonationTarget({
  siteName,
  targetType,
  boardName,
  seriesName,
}: {
  siteName: string;
  targetType: DonationTargetType;
  boardName: string;
  seriesName: string;
}): Promise<DonationTarget> {
  const site = await getSiteByName(siteName);

  if (targetType === 'site') {
    await validateSiteDonationTarget(site);

    return {
      targetType: 'site',
      paymentType: PAYMENT_TYPE.DONATION_SITE,
      paymentTargetType: PAYMENT_TARGET_TYPE.SITE,
      site,
      board: null,
      series: null,
      orderName: `${site.site_label || site.site_key} 블로그 후원`,
    };
  }

  if (!boardName) {
    throw new Error('boardName이 유효하지 않습니다.');
  }

  if (!seriesName) {
    throw new Error('seriesName이 유효하지 않습니다.');
  }

  const board = await getBoardByName({
    siteId: site.id,
    boardName,
  });

  if (site.site_type === 'community' && !['basic', 'gallery'].includes(board.board_type)) {
    throw new Error('일반 또는 갤러리 게시판의 연재만 후원할 수 있습니다.');
  }

  if (site.site_type === 'blog') {
    const supabaseAdmin = getSupabaseAdmin();
    const blogResult = await supabaseAdmin.from('blogs').select('blog_type').eq('site_id', site.id).maybeSingle();

    if (blogResult.data?.blog_type === 'team') {
      throw new Error('팀 블로그 연재는 후원을 받을 수 없습니다.');
    }
  }

  const series = await getSeriesByName({
    siteId: site.id,
    boardId: board.id,
    seriesName,
  });

  return {
    targetType: 'series',
    paymentType: PAYMENT_TYPE.DONATION_SERIES,
    paymentTargetType: PAYMENT_TARGET_TYPE.SERIES,
    site,
    board,
    series,
    orderName: `${series.series_label} 연재 후원`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId || !session.stigmaId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = (await request.json()) as DonationStartBody;
    const minorControl = await enforceMinorPaymentControl(session.stigmaId, body.guardianIdentityVerificationId);
    if (minorControl.error)
      return Response.json({ error: minorControl.error, guardianAuthRequired: true }, { status: 403 });

    const siteName = normalizeText(body.siteName).toLowerCase();
    const targetTypeValue = normalizeText(body.targetType).toLowerCase();
    const targetType = isDonationTargetType(targetTypeValue) ? targetTypeValue : 'site';
    const boardName = normalizeText(body.boardName).toLowerCase();
    const seriesName = normalizeText(body.seriesName).toLowerCase();
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
      seriesName,
    });

    const orderNo = createOrderNo(target.targetType);
    const paymentId = createPortOnePaymentKey(orderNo);
    const successUrl = getSafeRedirectUrl(request, body.successUrl);
    const failUrl = getSafeRedirectUrl(request, body.failUrl);

    successUrl.searchParams.set('siteId', target.site.id);
    successUrl.searchParams.set('orderNo', orderNo);
    successUrl.searchParams.set('paymentId', paymentId);
    successUrl.searchParams.set('paymentType', target.paymentType);
    successUrl.searchParams.set('targetType', target.paymentTargetType);
    successUrl.searchParams.set('amount', String(amount));

    failUrl.searchParams.set('siteId', target.site.id);
    failUrl.searchParams.set('orderNo', orderNo);
    failUrl.searchParams.set('paymentId', paymentId);
    failUrl.searchParams.set('paymentType', target.paymentType);
    failUrl.searchParams.set('targetType', target.paymentTargetType);
    failUrl.searchParams.set('amount', String(amount));

    if (target.targetType === 'series') {
      successUrl.searchParams.set('boardId', target.board.id);
      successUrl.searchParams.set('seriesId', target.series.id);
      successUrl.searchParams.set('boardName', target.board.board_key);
      successUrl.searchParams.set('seriesName', target.series.series_key);

      failUrl.searchParams.set('boardId', target.board.id);
      failUrl.searchParams.set('seriesId', target.series.id);
      failUrl.searchParams.set('boardName', target.board.board_key);
      failUrl.searchParams.set('seriesName', target.series.series_key);
    }

    return Response.json({
      storeId: getPortOneStoreId(),
      channelKey: getPortOneKpnGeneralChannelKey(),
      orderNo,
      paymentId,
      orderName: target.orderName,
      amount,
      redirectUrl: successUrl.toString(),
      failUrl: failUrl.toString(),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '후원을 시작하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '후원을 시작하지 못했습니다.' }, { status: 500 });
  }
}
