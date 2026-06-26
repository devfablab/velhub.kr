import { getCurrentPortOneProvider } from '@/lib/payments/portone';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import {
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PAYMENT_TARGET_TYPE,
  PAYMENT_TYPE,
  REFUND_POLICY,
  SUBSCRIPTION_TYPE,
} from '@/lib/payments/types';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type PaymentFailBody = {
  paymentType?: string;
  orderNo?: string;
  code?: string;
  message?: string;
  siteId?: string;
  siteName?: string;
  targetType?: string;
  boardId?: string;
  boardName?: string;
  seriesId?: string;
  seriesName?: string | null;
  postId?: string;
  contentId?: string;
  amount?: number;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string;
  plan_type: string | null;
};

type PlanRow = {
  id: string;
  price: number;
};

type SubscriptionSettingRow = {
  price: number;
  is_enabled: boolean;
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
  is_subscription: boolean | null;
};

type PostRow = {
  id: string;
  slug: number;
  site_id: string;
  board_id: string;
  series_id: string;
  subject: string;
  published_status: string;
  is_closed: boolean;
};

type ExistingPaymentRow = {
  id: string;
  status: string;
};

type PostPaymentInfo = {
  site_id: string;
  board_id: string;
  series_id: string;
  post_id: string;
};

type PaymentFailInfo = {
  amount: number;
  paymentType: string;
  targetType: string;
  targetId: string;
  postPayment: PostPaymentInfo | null;
  refundPolicy: string;
  failureStage: string;
};

function getPaymentType(value: string) {
  if (
    value === PAYMENT_TYPE.PLAN_BILLING ||
    value === PAYMENT_TYPE.DONATION_SITE ||
    value === PAYMENT_TYPE.DONATION_POST ||
    value === PAYMENT_TYPE.PURCHASE_POST ||
    value === PAYMENT_TYPE.MEMBERSHIP_BLOG ||
    value === PAYMENT_TYPE.SUBSCRIPTION_BOARD ||
    value === PAYMENT_TYPE.SUBSCRIPTION_SERIES
  ) {
    return value;
  }

  return '';
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

function getPostPurchasePrice(seriesSubscriptionPrice: number) {
  return Math.floor((seriesSubscriptionPrice * 27) / 100 / 1000) * 1000;
}

async function getSiteById(supabaseAdmin: SupabaseAdminClient, siteId: string) {
  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_label, plan_type')
    .eq('id', siteId)
    .maybeSingle();

  if (siteResult.error) {
    throw new Error('사이트 정보를 확인하지 못했습니다.');
  }

  if (!siteResult.data) {
    throw new Error('사이트 정보를 찾을 수 없습니다.');
  }

  return siteResult.data as SiteRow;
}

async function getSiteByName(supabaseAdmin: SupabaseAdminClient, siteName: string) {
  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_label, plan_type')
    .eq('site_key', siteName)
    .maybeSingle();

  if (siteResult.error) {
    throw new Error('사이트 정보를 확인하지 못했습니다.');
  }

  if (!siteResult.data) {
    throw new Error('사이트 정보를 찾을 수 없습니다.');
  }

  return siteResult.data as SiteRow;
}

async function getBoardByName({
  supabaseAdmin,
  siteId,
  boardName,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  boardName: string;
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

  return boardResult.data as BoardRow;
}

async function getBoardById({
  supabaseAdmin,
  siteId,
  boardId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  boardId: string;
}) {
  const boardResult = await supabaseAdmin
    .from('boards')
    .select('id, board_key, board_label')
    .eq('site_id', siteId)
    .eq('id', boardId)
    .maybeSingle();

  if (boardResult.error) {
    throw new Error('게시판 정보를 확인하지 못했습니다.');
  }

  if (!boardResult.data) {
    throw new Error('게시판 정보를 찾을 수 없습니다.');
  }

  return boardResult.data as BoardRow;
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
    .select('id, slug, site_id, board_id, series_id, subject, published_status, is_closed')
    .eq('site_id', siteId)
    .eq('id', postId)
    .maybeSingle();

  if (postResult.error) {
    throw new Error('글 정보를 확인하지 못했습니다.');
  }

  if (!postResult.data) {
    throw new Error('글 정보를 찾을 수 없습니다.');
  }

  const post = postResult.data as PostRow;

  if (post.published_status !== 'published') {
    throw new Error('공개된 글만 결제할 수 있습니다.');
  }

  if (post.is_closed) {
    throw new Error('현재 결제할 수 없는 글입니다.');
  }

  if (!post.series_id) {
    throw new Error('연재 글만 결제할 수 있습니다.');
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
    .select('id, series_key, series_label, is_subscription')
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

  return seriesResult.data as SeriesRow;
}

async function getSeriesByName({
  supabaseAdmin,
  siteId,
  boardId,
  seriesName,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  boardId: string;
  seriesName: string;
}) {
  const seriesResult = await supabaseAdmin
    .from('board_series')
    .select('id, series_key, series_label, is_subscription')
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .eq('series_key', seriesName)
    .maybeSingle();

  if (seriesResult.error) {
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
    throw new Error('연재 개수를 확인하지 못했습니다.');
  }

  return seriesCountResult.count ?? 0;
}

async function getPlanBillingFailInfo({
  supabaseAdmin,
  siteId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
}): Promise<PaymentFailInfo> {
  const site = await getSiteById(supabaseAdmin, siteId);

  if (!site.plan_type) {
    throw new Error('사이트 요금제가 설정되지 않았습니다.');
  }

  const planResult = await supabaseAdmin.from('plans').select('id, price').eq('id', site.plan_type).maybeSingle();

  if (planResult.error) {
    throw new Error('요금제 정보를 확인하지 못했습니다.');
  }

  if (!planResult.data) {
    throw new Error('요금제 정보를 찾을 수 없습니다.');
  }

  const plan = planResult.data as PlanRow;

  return {
    amount: plan.price,
    paymentType: PAYMENT_TYPE.PLAN_BILLING,
    targetType: PAYMENT_TARGET_TYPE.PLAN,
    targetId: site.id,
    postPayment: null,
    refundPolicy: REFUND_POLICY.SEVEN_DAYS,
    failureStage: 'plan_billing_fail',
  };
}

async function getDonationSiteFailInfo({
  supabaseAdmin,
  siteId,
  amount,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  amount: number | undefined;
}): Promise<PaymentFailInfo> {
  await getSiteById(supabaseAdmin, siteId);

  if (typeof amount !== 'number' || !validateDonationAmount(amount)) {
    throw new Error('후원금액이 올바르지 않습니다.');
  }

  return {
    amount,
    paymentType: PAYMENT_TYPE.DONATION_SITE,
    targetType: PAYMENT_TARGET_TYPE.SITE,
    targetId: siteId,
    postPayment: null,
    refundPolicy: REFUND_POLICY.DONATION_RESTRICTED,
    failureStage: 'donation_site_fail',
  };
}

async function getDonationPostFailInfo({
  supabaseAdmin,
  siteId,
  postId,
  amount,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  postId: string;
  amount: number | undefined;
}): Promise<PaymentFailInfo> {
  await getSiteById(supabaseAdmin, siteId);

  if (typeof amount !== 'number' || !validateDonationAmount(amount)) {
    throw new Error('후원금액이 올바르지 않습니다.');
  }

  const post = await getPostById({
    supabaseAdmin,
    siteId,
    postId,
  });

  const seriesCount = await getBoardSeriesCount({
    supabaseAdmin,
    siteId,
    boardId: post.board_id,
  });

  if (seriesCount < 2) {
    throw new Error('연재가 2개 이상 있는 게시판의 연재 글만 후원할 수 있습니다.');
  }

  return {
    amount,
    paymentType: PAYMENT_TYPE.DONATION_POST,
    targetType: PAYMENT_TARGET_TYPE.POST,
    targetId: post.id,
    postPayment: {
      site_id: siteId,
      board_id: post.board_id,
      series_id: post.series_id,
      post_id: post.id,
    },
    refundPolicy: REFUND_POLICY.DONATION_RESTRICTED,
    failureStage: 'donation_post_fail',
  };
}

async function getPostPurchaseFailInfo({
  supabaseAdmin,
  siteId,
  postId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  postId: string;
}): Promise<PaymentFailInfo> {
  await getSiteById(supabaseAdmin, siteId);

  const post = await getPostById({
    supabaseAdmin,
    siteId,
    postId,
  });

  const series = await getSeriesById({
    supabaseAdmin,
    siteId,
    boardId: post.board_id,
    seriesId: post.series_id,
  });

  if (series.is_subscription !== true) {
    throw new Error('구독 설정된 연재 글만 구매할 수 있습니다.');
  }

  const settingResult = await supabaseAdmin
    .from('subscription_settings')
    .select('price, is_enabled')
    .eq('target_type', PAYMENT_TARGET_TYPE.SERIES)
    .eq('target_id', post.series_id)
    .eq('subscription_type', SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES)
    .maybeSingle();

  if (settingResult.error) {
    throw new Error('연재 구독 설정을 확인하지 못했습니다.');
  }

  if (!settingResult.data) {
    throw new Error('연재 구독 설정을 찾을 수 없습니다.');
  }

  const setting = settingResult.data as SubscriptionSettingRow;

  if (!setting.is_enabled) {
    throw new Error('구독이 켜진 연재 글만 구매할 수 있습니다.');
  }

  return {
    amount: getPostPurchasePrice(setting.price),
    paymentType: PAYMENT_TYPE.PURCHASE_POST,
    targetType: PAYMENT_TARGET_TYPE.POST,
    targetId: post.id,
    postPayment: {
      site_id: siteId,
      board_id: post.board_id,
      series_id: post.series_id,
      post_id: post.id,
    },
    refundPolicy: REFUND_POLICY.SEVEN_DAYS,
    failureStage: 'purchase_post_fail',
  };
}

async function getMembershipFailInfo({
  supabaseAdmin,
  siteName,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteName: string;
}): Promise<PaymentFailInfo> {
  const site = await getSiteByName(supabaseAdmin, siteName);

  const settingResult = await supabaseAdmin
    .from('subscription_settings')
    .select('price, is_enabled')
    .eq('target_type', PAYMENT_TARGET_TYPE.SITE)
    .eq('target_id', site.id)
    .eq('subscription_type', SUBSCRIPTION_TYPE.MEMBERSHIP_BLOG)
    .maybeSingle();

  if (settingResult.error) {
    throw new Error('멤버십 설정을 확인하지 못했습니다.');
  }

  if (!settingResult.data) {
    throw new Error('멤버십 설정을 찾을 수 없습니다.');
  }

  const setting = settingResult.data as SubscriptionSettingRow;

  return {
    amount: setting.price,
    paymentType: PAYMENT_TYPE.MEMBERSHIP_BLOG,
    targetType: PAYMENT_TARGET_TYPE.SITE,
    targetId: site.id,
    postPayment: null,
    refundPolicy: REFUND_POLICY.SEVEN_DAYS,
    failureStage: 'membership_fail',
  };
}

async function getSubscriptionFailInfo({
  supabaseAdmin,
  siteName,
  boardName,
  targetType,
  seriesName,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteName: string;
  boardName: string;
  targetType: string;
  seriesName: string;
}): Promise<PaymentFailInfo> {
  const site = await getSiteByName(supabaseAdmin, siteName);

  const board = await getBoardByName({
    supabaseAdmin,
    siteId: site.id,
    boardName,
  });

  if (targetType === PAYMENT_TARGET_TYPE.BOARD || targetType === 'board') {
    const settingResult = await supabaseAdmin
      .from('subscription_settings')
      .select('price, is_enabled')
      .eq('target_type', PAYMENT_TARGET_TYPE.BOARD)
      .eq('target_id', board.id)
      .eq('subscription_type', SUBSCRIPTION_TYPE.SUBSCRIPTION_BOARD)
      .maybeSingle();

    if (settingResult.error) {
      throw new Error('게시판 구독 설정을 확인하지 못했습니다.');
    }

    if (!settingResult.data) {
      throw new Error('게시판 구독 설정을 찾을 수 없습니다.');
    }

    const setting = settingResult.data as SubscriptionSettingRow;

    return {
      amount: setting.price,
      paymentType: PAYMENT_TYPE.SUBSCRIPTION_BOARD,
      targetType: PAYMENT_TARGET_TYPE.BOARD,
      targetId: board.id,
      postPayment: null,
      refundPolicy: REFUND_POLICY.SEVEN_DAYS,
      failureStage: 'subscription_board_fail',
    };
  }

  if (targetType !== PAYMENT_TARGET_TYPE.SERIES && targetType !== 'series') {
    throw new Error('targetType이 유효하지 않습니다.');
  }

  if (!seriesName) {
    throw new Error('seriesName이 유효하지 않습니다.');
  }

  const series = await getSeriesByName({
    supabaseAdmin,
    siteId: site.id,
    boardId: board.id,
    seriesName,
  });

  const settingResult = await supabaseAdmin
    .from('subscription_settings')
    .select('price, is_enabled')
    .eq('target_type', PAYMENT_TARGET_TYPE.SERIES)
    .eq('target_id', series.id)
    .eq('subscription_type', SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES)
    .maybeSingle();

  if (settingResult.error) {
    throw new Error('연재 구독 설정을 확인하지 못했습니다.');
  }

  if (!settingResult.data) {
    throw new Error('연재 구독 설정을 찾을 수 없습니다.');
  }

  const setting = settingResult.data as SubscriptionSettingRow;

  return {
    amount: setting.price,
    paymentType: PAYMENT_TYPE.SUBSCRIPTION_SERIES,
    targetType: PAYMENT_TARGET_TYPE.SERIES,
    targetId: series.id,
    postPayment: null,
    refundPolicy: REFUND_POLICY.SEVEN_DAYS,
    failureStage: 'subscription_series_fail',
  };
}

async function getPaymentFailInfo({
  supabaseAdmin,
  body,
}: {
  supabaseAdmin: SupabaseAdminClient;
  body: PaymentFailBody;
}) {
  const paymentType = getPaymentType(normalizeText(body.paymentType));
  const siteId = normalizeText(body.siteId);
  const siteName = normalizeText(body.siteName).toLowerCase();
  const boardId = normalizeText(body.boardId);
  const boardName = normalizeText(body.boardName).toLowerCase();
  const targetType = normalizeText(body.targetType);
  const seriesName = normalizeText(body.seriesName).toLowerCase();
  const postId = normalizeText(body.postId);

  if (paymentType === PAYMENT_TYPE.PLAN_BILLING) {
    if (!siteId) {
      throw new Error('siteId가 유효하지 않습니다.');
    }

    return getPlanBillingFailInfo({ supabaseAdmin, siteId });
  }

  if (paymentType === PAYMENT_TYPE.DONATION_SITE) {
    if (!siteId) {
      throw new Error('siteId가 유효하지 않습니다.');
    }

    return getDonationSiteFailInfo({
      supabaseAdmin,
      siteId,
      amount: body.amount,
    });
  }

  if (paymentType === PAYMENT_TYPE.DONATION_POST) {
    if (!siteId) {
      throw new Error('siteId가 유효하지 않습니다.');
    }

    if (!postId) {
      throw new Error('postId가 유효하지 않습니다.');
    }

    return getDonationPostFailInfo({
      supabaseAdmin,
      siteId,
      postId,
      amount: body.amount,
    });
  }

  if (paymentType === PAYMENT_TYPE.PURCHASE_POST) {
    if (!siteId) {
      throw new Error('siteId가 유효하지 않습니다.');
    }

    if (!postId) {
      throw new Error('postId가 유효하지 않습니다.');
    }

    return getPostPurchaseFailInfo({
      supabaseAdmin,
      siteId,
      postId,
    });
  }

  if (paymentType === PAYMENT_TYPE.MEMBERSHIP_BLOG) {
    if (!siteName) {
      throw new Error('siteName이 유효하지 않습니다.');
    }

    return getMembershipFailInfo({ supabaseAdmin, siteName });
  }

  if (paymentType === PAYMENT_TYPE.SUBSCRIPTION_BOARD || paymentType === PAYMENT_TYPE.SUBSCRIPTION_SERIES) {
    if (!siteName && !siteId) {
      throw new Error('사이트 정보가 유효하지 않습니다.');
    }

    if (!boardName && !boardId) {
      throw new Error('게시판 정보가 유효하지 않습니다.');
    }

    if (siteName && boardName) {
      return getSubscriptionFailInfo({
        supabaseAdmin,
        siteName,
        boardName,
        targetType,
        seriesName,
      });
    }

    const site = await getSiteById(supabaseAdmin, siteId);
    const board = await getBoardById({
      supabaseAdmin,
      siteId: site.id,
      boardId,
    });

    return getSubscriptionFailInfo({
      supabaseAdmin,
      siteName: site.site_key,
      boardName: board.board_key,
      targetType,
      seriesName,
    });
  }

  throw new Error('paymentType이 유효하지 않습니다.');
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PaymentFailBody;
    const orderNo = normalizeText(body.orderNo);
    const failureCode = normalizeText(body.code);
    const failureMessage = normalizeText(body.message);

    if (!orderNo) {
      return Response.json({ error: 'orderNo가 유효하지 않습니다.' }, { status: 400 });
    }

    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const existingPaymentResult = await supabaseAdmin
      .from('payments')
      .select('id, status')
      .eq('order_no', orderNo)
      .limit(1);

    if (existingPaymentResult.error) {
      console.error(existingPaymentResult.error);

      return Response.json({ error: '결제 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const existingPayment = ((existingPaymentResult.data ?? [])[0] as ExistingPaymentRow | undefined) ?? null;

    if (existingPayment) {
      return Response.json({
        ok: true,
        paymentId: existingPayment.id,
        status: existingPayment.status,
      });
    }

    const failInfo = await getPaymentFailInfo({
      supabaseAdmin,
      body,
    });

    const paymentInsertResult = await supabaseAdmin
      .from('payments')
      .insert({
        provider: getCurrentPortOneProvider(),
        payment_key: null,
        order_no: orderNo,
        buyer_user_id: session.authUserId,
        amount: failInfo.amount,
        refunded_amount: 0,
        currency: 'KRW',
        status: PAYMENT_STATUS.FAILED,
        payment_method: PAYMENT_METHOD.CARD,
        payment_type: failInfo.paymentType,
        target_type: failInfo.targetType,
        target_id: failInfo.targetId,
        post_payment: failInfo.postPayment,
        subscription_id: null,
        failure_code: failureCode || null,
        failure_message: failureMessage || null,
        failure_stage: failInfo.failureStage,
        refund_policy: failInfo.refundPolicy,
        refundable_until: null,
        approved_at: null,
        refunded_at: null,
        raw_data: {
          code: failureCode,
          message: failureMessage,
          paymentType: failInfo.paymentType,
          targetType: failInfo.targetType,
          targetId: failInfo.targetId,
          postPayment: failInfo.postPayment,
        },
      })
      .select('id')
      .single();

    if (paymentInsertResult.error) {
      console.error(paymentInsertResult.error);

      return Response.json({ error: '결제 실패 내역을 저장하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      paymentId: paymentInsertResult.data.id,
      status: PAYMENT_STATUS.FAILED,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '결제 실패 내역을 저장하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '결제 실패 내역을 저장하지 못했습니다.' }, { status: 500 });
  }
}
