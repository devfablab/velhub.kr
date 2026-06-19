import {
  PAYMENT_METHOD,
  PAYMENT_PROVIDER,
  PAYMENT_STATUS,
  PAYMENT_TARGET_TYPE,
  PAYMENT_TYPE,
  REFUND_POLICY,
  SUBSCRIPTION_TYPE,
} from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type PaymentFailBody = {
  paymentType?: string;
  orderNo?: string;
  code?: string;
  message?: string;
  siteId?: string;
  siteName?: string;
  targetType?: string;
  boardName?: string;
  seriesName?: string | null;
  amount?: number;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
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
};

type ExistingPaymentRow = {
  id: string;
  status: string;
};

type PaymentFailInfo = {
  amount: number;
  paymentType: string;
  targetType: string;
  targetId: string;
  refundPolicy: string;
  failureStage: string;
};

function getPaymentType(value: string) {
  if (
    value === PAYMENT_TYPE.PLAN_BILLING ||
    value === PAYMENT_TYPE.DONATION_SITE ||
    value === PAYMENT_TYPE.BLOG_MEMBERSHIP ||
    value === PAYMENT_TYPE.BOARD_SUBSCRIPTION ||
    value === PAYMENT_TYPE.SERIES_SUBSCRIPTION
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
    refundPolicy: REFUND_POLICY.SEVEN_DAYS,
    failureStage: 'plan_billing_fail',
  };
}

async function getDonationFailInfo({
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
    refundPolicy: REFUND_POLICY.SEVEN_DAYS,
    failureStage: 'donation_site_fail',
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
    .eq('target_type', PAYMENT_TARGET_TYPE.BLOG)
    .eq('target_id', site.id)
    .eq('subscription_type', SUBSCRIPTION_TYPE.BLOG_MEMBERSHIP)
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
    paymentType: PAYMENT_TYPE.BLOG_MEMBERSHIP,
    targetType: PAYMENT_TARGET_TYPE.BLOG,
    targetId: site.id,
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

  const boardResult = await supabaseAdmin
    .from('boards')
    .select('id, board_key, board_label')
    .eq('site_id', site.id)
    .eq('board_key', boardName)
    .maybeSingle();

  if (boardResult.error) {
    throw new Error('게시판 정보를 확인하지 못했습니다.');
  }

  if (!boardResult.data) {
    throw new Error('게시판 정보를 찾을 수 없습니다.');
  }

  const board = boardResult.data as BoardRow;

  if (targetType === PAYMENT_TARGET_TYPE.BOARD) {
    const settingResult = await supabaseAdmin
      .from('subscription_settings')
      .select('price, is_enabled')
      .eq('target_type', PAYMENT_TARGET_TYPE.BOARD)
      .eq('target_id', board.id)
      .eq('subscription_type', SUBSCRIPTION_TYPE.BOARD_SUBSCRIPTION)
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
      paymentType: PAYMENT_TYPE.BOARD_SUBSCRIPTION,
      targetType: PAYMENT_TARGET_TYPE.BOARD,
      targetId: board.id,
      refundPolicy: REFUND_POLICY.SEVEN_DAYS,
      failureStage: 'board_subscription_fail',
    };
  }

  if (targetType !== PAYMENT_TARGET_TYPE.SERIES) {
    throw new Error('targetType이 유효하지 않습니다.');
  }

  if (!seriesName) {
    throw new Error('seriesName이 유효하지 않습니다.');
  }

  const seriesResult = await supabaseAdmin
    .from('board_series')
    .select('id, series_key, series_label')
    .eq('site_id', site.id)
    .eq('board_id', board.id)
    .eq('series_key', seriesName)
    .maybeSingle();

  if (seriesResult.error) {
    throw new Error('연재 정보를 확인하지 못했습니다.');
  }

  if (!seriesResult.data) {
    throw new Error('연재 정보를 찾을 수 없습니다.');
  }

  const series = seriesResult.data as SeriesRow;

  const settingResult = await supabaseAdmin
    .from('subscription_settings')
    .select('price, is_enabled')
    .eq('target_type', PAYMENT_TARGET_TYPE.SERIES)
    .eq('target_id', series.id)
    .eq('subscription_type', SUBSCRIPTION_TYPE.SERIES_SUBSCRIPTION)
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
    paymentType: PAYMENT_TYPE.SERIES_SUBSCRIPTION,
    targetType: PAYMENT_TARGET_TYPE.SERIES,
    targetId: series.id,
    refundPolicy: REFUND_POLICY.SEVEN_DAYS,
    failureStage: 'series_subscription_fail',
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
  const boardName = normalizeText(body.boardName).toLowerCase();
  const targetType = normalizeText(body.targetType);
  const seriesName = normalizeText(body.seriesName).toLowerCase();

  if (paymentType === PAYMENT_TYPE.PLAN_BILLING) {
    if (!siteId) {
      throw new Error('siteId가 유효하지 않습니다.');
    }

    return getPlanBillingFailInfo({
      supabaseAdmin,
      siteId,
    });
  }

  if (paymentType === PAYMENT_TYPE.DONATION_SITE) {
    if (!siteId) {
      throw new Error('siteId가 유효하지 않습니다.');
    }

    return getDonationFailInfo({
      supabaseAdmin,
      siteId,
      amount: body.amount,
    });
  }

  if (paymentType === PAYMENT_TYPE.BLOG_MEMBERSHIP) {
    if (!siteName) {
      throw new Error('siteName이 유효하지 않습니다.');
    }

    return getMembershipFailInfo({
      supabaseAdmin,
      siteName,
    });
  }

  if (paymentType === PAYMENT_TYPE.BOARD_SUBSCRIPTION || paymentType === PAYMENT_TYPE.SERIES_SUBSCRIPTION) {
    if (!siteName) {
      throw new Error('siteName이 유효하지 않습니다.');
    }

    if (!boardName) {
      throw new Error('boardName이 유효하지 않습니다.');
    }

    return getSubscriptionFailInfo({
      supabaseAdmin,
      siteName,
      boardName,
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
      .maybeSingle();

    if (existingPaymentResult.error) {
      console.error(existingPaymentResult.error);

      return Response.json({ error: '결제 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (existingPaymentResult.data) {
      const existingPayment = existingPaymentResult.data as ExistingPaymentRow;

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
        provider: PAYMENT_PROVIDER.TOSS,
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
        post_payment: null,
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
