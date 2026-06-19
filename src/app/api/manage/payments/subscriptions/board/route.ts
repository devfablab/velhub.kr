import {
  PAYMENT_STATUS,
  PAYMENT_TARGET_TYPE,
  PAYMENT_TYPE,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TYPE,
} from '@/lib/payments/types';
import {
  PARENT_SUBSCRIPTION_MIN_PRICE,
  getRequiredParentSubscriptionPrice,
  validateParentSubscriptionPrice,
} from '@/lib/payments/subscriptionPrice';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  site_type: string;
};

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string;
  site_id: string;
};

type SeriesRow = {
  id: string;
};

type SeriesSettingRow = {
  target_id: string;
  price: number;
  is_enabled: boolean;
};

type SubscriptionSettingRow = {
  id: string;
  target_id: string;
  is_enabled: boolean;
  price: number;
};

type SubscriptionRow = {
  id: string;
  subscriber_user_id: string;
  target_id: string;
  status: string;
  price: number;
  created_at: string;
};

type PaymentRow = {
  id: string;
  buyer_user_id: string;
  target_id: string;
  amount: number;
  approved_at: string | null;
  created_at: string;
};

type PaymentStats = {
  activeMonths: number;
  lastPaidAt: string | null;
  lastPaidAmount: number | null;
  totalPaidAmount: number;
};

type StigmaRow = {
  id: string;
  user_id: string;
};

type RhizomeStigmaRow = {
  user_id: string;
  nickname: string;
};

function getSubscriptionStatus(status: string) {
  if (status === SUBSCRIPTION_STATUS.ACTIVE) return '유지 중';
  if (status === SUBSCRIPTION_STATUS.PAST_DUE) return '결제 유예 중';

  return '중단';
}

async function getSiteAndSession(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_label, site_type')
    .eq('site_key', siteName)
    .maybeSingle();

  if (siteResult.error) {
    console.error(siteResult.error);

    return {
      response: Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 500 }),
      site: null,
      supabaseAdmin,
    };
  }

  if (!siteResult.data) {
    return {
      response: Response.json({ error: '사이트 정보를 찾을 수 없습니다.' }, { status: 404 }),
      site: null,
      supabaseAdmin,
    };
  }

  const site = siteResult.data as SiteRow;
  const session = await verifySession({ siteId: site.id });

  if (session.case !== 'staff') {
    return {
      response: Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 }),
      site: null,
      supabaseAdmin,
    };
  }

  if (site.site_type !== 'community') {
    return {
      response: Response.json({ error: '게시판 구독은 커뮤니티에서만 사용할 수 있습니다.' }, { status: 400 }),
      site: null,
      supabaseAdmin,
    };
  }

  return {
    response: null,
    site,
    supabaseAdmin,
  };
}

async function getMaxEnabledSeriesPrice({
  supabaseAdmin,
  siteId,
  boardId,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  siteId: string;
  boardId: string;
}) {
  const seriesResult = await supabaseAdmin
    .from('board_series')
    .select('id')
    .eq('site_id', siteId)
    .eq('board_id', boardId);

  if (seriesResult.error) {
    throw new Error('연재 구독 설정을 확인하지 못했습니다.');
  }

  const seriesList = (seriesResult.data ?? []) as SeriesRow[];
  const seriesIds = seriesList.map((series) => series.id);

  if (!seriesIds.length) {
    return 0;
  }

  const settingsResult = await supabaseAdmin
    .from('subscription_settings')
    .select('target_id, price, is_enabled')
    .eq('target_type', PAYMENT_TARGET_TYPE.SERIES)
    .eq('subscription_type', SUBSCRIPTION_TYPE.SERIES_SUBSCRIPTION)
    .eq('is_enabled', true)
    .in('target_id', seriesIds);

  if (settingsResult.error) {
    throw new Error('연재 구독 설정을 확인하지 못했습니다.');
  }

  const settings = (settingsResult.data ?? []) as SeriesSettingRow[];

  if (!settings.length) {
    return 0;
  }

  return Math.max(...settings.map((setting) => setting.price));
}

async function getRequiredPriceByBoardId({
  supabaseAdmin,
  siteId,
  boardIds,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  siteId: string;
  boardIds: string[];
}) {
  const result = new Map<string, { maxSeriesPrice: number; requiredMinPrice: number }>();

  for (const boardId of boardIds) {
    const maxSeriesPrice = await getMaxEnabledSeriesPrice({ supabaseAdmin, siteId, boardId });

    result.set(boardId, {
      maxSeriesPrice,
      requiredMinPrice: getRequiredParentSubscriptionPrice(maxSeriesPrice),
    });
  }

  return result;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const siteAndSession = await getSiteAndSession(siteName);

    if (siteAndSession.response || !siteAndSession.site) {
      return siteAndSession.response;
    }

    const { site, supabaseAdmin } = siteAndSession;

    const boardsResult = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, site_id')
      .eq('site_id', site.id)
      .not('board_key', 'in', '(b,p)')
      .order('board_label', { ascending: true });

    if (boardsResult.error) {
      console.error(boardsResult.error);

      return Response.json({ error: '게시판 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const boards = (boardsResult.data ?? []) as BoardRow[];
    const boardIds = boards.map((board) => board.id);
    const requiredPriceByBoardId = await getRequiredPriceByBoardId({ supabaseAdmin, siteId: site.id, boardIds });

    const settingsResult = boardIds.length
      ? await supabaseAdmin
          .from('subscription_settings')
          .select('id, target_id, is_enabled, price')
          .eq('target_type', PAYMENT_TARGET_TYPE.BOARD)
          .eq('subscription_type', SUBSCRIPTION_TYPE.BOARD_SUBSCRIPTION)
          .in('target_id', boardIds)
      : { data: [], error: null };

    if (settingsResult.error) {
      console.error(settingsResult.error);

      return Response.json({ error: '게시판 구독 설정을 불러오지 못했습니다.' }, { status: 500 });
    }

    const settings = (settingsResult.data ?? []) as SubscriptionSettingRow[];
    const settingByBoardId = new Map(settings.map((setting) => [setting.target_id, setting]));

    const subscriptionsResult = boardIds.length
      ? await supabaseAdmin
          .from('subscriptions')
          .select('id, subscriber_user_id, target_id, status, price, created_at')
          .eq('subscription_type', SUBSCRIPTION_TYPE.BOARD_SUBSCRIPTION)
          .eq('target_type', PAYMENT_TARGET_TYPE.BOARD)
          .in('target_id', boardIds)
          .order('created_at', { ascending: false })
      : { data: [], error: null };

    if (subscriptionsResult.error) {
      console.error(subscriptionsResult.error);

      return Response.json({ error: '게시판 구독자 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const subscriptions = (subscriptionsResult.data ?? []) as SubscriptionRow[];
    const latestSubscriptionByKey = new Map<string, SubscriptionRow>();

    for (const subscription of subscriptions) {
      const subscriptionKey = `${subscription.target_id}:${subscription.subscriber_user_id}`;

      if (!latestSubscriptionByKey.has(subscriptionKey)) {
        latestSubscriptionByKey.set(subscriptionKey, subscription);
      }
    }

    const latestSubscriptions = Array.from(latestSubscriptionByKey.values());

    const paymentsResult = boardIds.length
      ? await supabaseAdmin
          .from('payments')
          .select('id, buyer_user_id, target_id, amount, approved_at, created_at')
          .eq('payment_type', PAYMENT_TYPE.BOARD_SUBSCRIPTION)
          .eq('target_type', PAYMENT_TARGET_TYPE.BOARD)
          .eq('status', PAYMENT_STATUS.PAID)
          .in('target_id', boardIds)
      : { data: [], error: null };

    if (paymentsResult.error) {
      console.error(paymentsResult.error);

      return Response.json({ error: '게시판 구독 결제 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const payments = (paymentsResult.data ?? []) as PaymentRow[];
    const paymentStatsByKey = new Map<string, PaymentStats>();

    for (const payment of payments) {
      const paymentKey = `${payment.target_id}:${payment.buyer_user_id}`;
      const paidAt = payment.approved_at ?? payment.created_at;
      const currentStats = paymentStatsByKey.get(paymentKey);

      if (!currentStats) {
        paymentStatsByKey.set(paymentKey, {
          activeMonths: 1,
          lastPaidAt: paidAt,
          lastPaidAmount: payment.amount,
          totalPaidAmount: payment.amount,
        });

        continue;
      }

      const isLatestPayment = !currentStats.lastPaidAt || paidAt > currentStats.lastPaidAt;

      paymentStatsByKey.set(paymentKey, {
        activeMonths: currentStats.activeMonths + 1,
        lastPaidAt: isLatestPayment ? paidAt : currentStats.lastPaidAt,
        lastPaidAmount: isLatestPayment ? payment.amount : currentStats.lastPaidAmount,
        totalPaidAmount: currentStats.totalPaidAmount + payment.amount,
      });
    }

    const subscriberUserIds = Array.from(
      new Set(latestSubscriptions.map((subscription) => subscription.subscriber_user_id)),
    );

    const stigmasResult = subscriberUserIds.length
      ? await supabaseAdmin.from('stigmas').select('id, user_id').in('user_id', subscriberUserIds)
      : { data: [], error: null };

    if (stigmasResult.error) {
      console.error(stigmasResult.error);

      return Response.json({ error: '구독자 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const stigmas = (stigmasResult.data ?? []) as StigmaRow[];
    const stigmaIdByParticleId = new Map(stigmas.map((stigma) => [stigma.user_id, stigma.id]));
    const stigmaIds = stigmas.map((stigma) => stigma.id);

    const rhizomeStigmasResult = stigmaIds.length
      ? await supabaseAdmin
          .from('rhizome_stigmas')
          .select('user_id, nickname')
          .eq('site_id', site.id)
          .in('user_id', stigmaIds)
      : { data: [], error: null };

    if (rhizomeStigmasResult.error) {
      console.error(rhizomeStigmasResult.error);

      return Response.json({ error: '구독자 닉네임을 불러오지 못했습니다.' }, { status: 500 });
    }

    const rhizomeStigmas = (rhizomeStigmasResult.data ?? []) as RhizomeStigmaRow[];
    const nicknameByStigmaId = new Map(
      rhizomeStigmas.map((rhizomeStigma) => [rhizomeStigma.user_id, rhizomeStigma.nickname]),
    );
    const subscriptionsByBoardId = new Map<string, SubscriptionRow[]>();

    for (const subscription of latestSubscriptions) {
      const currentSubscriptions = subscriptionsByBoardId.get(subscription.target_id) ?? [];

      currentSubscriptions.push(subscription);
      subscriptionsByBoardId.set(subscription.target_id, currentSubscriptions);
    }

    return Response.json({
      site: {
        id: site.id,
        siteKey: site.site_key,
        siteLabel: site.site_label,
        siteType: site.site_type,
      },
      boards: boards.map((board) => {
        const setting = settingByBoardId.get(board.id);
        const boardSubscriptions = subscriptionsByBoardId.get(board.id) ?? [];
        const pricePolicy = requiredPriceByBoardId.get(board.id) ?? {
          maxSeriesPrice: 0,
          requiredMinPrice: PARENT_SUBSCRIPTION_MIN_PRICE,
        };

        return {
          id: board.id,
          boardKey: board.board_key,
          boardLabel: board.board_label,
          setting: setting
            ? {
                id: setting.id,
                isEnabled: setting.is_enabled,
                price: setting.price,
                requiredMinPrice: pricePolicy.requiredMinPrice,
                maxSeriesPrice: pricePolicy.maxSeriesPrice,
              }
            : {
                id: null,
                isEnabled: false,
                price: pricePolicy.requiredMinPrice,
                requiredMinPrice: pricePolicy.requiredMinPrice,
                maxSeriesPrice: pricePolicy.maxSeriesPrice,
              },
          subscribers: boardSubscriptions.map((subscription) => {
            const stigmaId = stigmaIdByParticleId.get(subscription.subscriber_user_id);
            const paymentStats = paymentStatsByKey.get(`${subscription.target_id}:${subscription.subscriber_user_id}`);

            return {
              id: subscription.id,
              nickname: stigmaId ? (nicknameByStigmaId.get(stigmaId) ?? '매칭 실패') : '매칭 실패',
              status: getSubscriptionStatus(subscription.status),
              activeMonths: paymentStats?.activeMonths ?? 0,
              lastPaidAt: paymentStats?.lastPaidAt ?? null,
              lastPaidAmount: paymentStats?.lastPaidAmount ?? null,
              totalPaidAmount: paymentStats?.totalPaidAmount ?? 0,
            };
          }),
        };
      }),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '게시판 구독 정보를 불러오지 못했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '게시판 구독 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const body = (await request.json()) as {
      boardId?: string;
      isEnabled?: boolean;
      price?: number;
    };

    const boardId = normalizeText(body.boardId);

    if (!boardId) {
      return Response.json({ error: '게시판 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    if (typeof body.isEnabled !== 'boolean') {
      return Response.json({ error: '게시판 구독 사용 여부가 올바르지 않습니다.' }, { status: 400 });
    }

    if (typeof body.price !== 'number') {
      return Response.json({ error: '게시판 구독 금액이 올바르지 않습니다.' }, { status: 400 });
    }

    const siteAndSession = await getSiteAndSession(siteName);

    if (siteAndSession.response || !siteAndSession.site) {
      return siteAndSession.response;
    }

    const { site, supabaseAdmin } = siteAndSession;

    const boardResult = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, site_id')
      .eq('id', boardId)
      .eq('site_id', site.id)
      .maybeSingle();

    if (boardResult.error) {
      console.error(boardResult.error);

      return Response.json({ error: '게시판 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!boardResult.data) {
      return Response.json({ error: '게시판 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const board = boardResult.data as BoardRow;

    if (board.board_key === 'b' || board.board_key === 'p') {
      return Response.json({ error: '해당 게시판은 구독을 사용할 수 없습니다.' }, { status: 400 });
    }

    const maxSeriesPrice = await getMaxEnabledSeriesPrice({
      supabaseAdmin,
      siteId: site.id,
      boardId: board.id,
    });

    if (body.isEnabled) {
      const priceValidation = validateParentSubscriptionPrice(body.price, maxSeriesPrice);

      if (!priceValidation.ok) {
        return Response.json({ error: priceValidation.message }, { status: 400 });
      }
    }

    const existingSettingResult = await supabaseAdmin
      .from('subscription_settings')
      .select('id')
      .eq('target_type', PAYMENT_TARGET_TYPE.BOARD)
      .eq('target_id', board.id)
      .eq('subscription_type', SUBSCRIPTION_TYPE.BOARD_SUBSCRIPTION)
      .maybeSingle();

    if (existingSettingResult.error) {
      console.error(existingSettingResult.error);

      return Response.json({ error: '게시판 구독 설정을 확인하지 못했습니다.' }, { status: 500 });
    }

    const payload = {
      target_type: PAYMENT_TARGET_TYPE.BOARD,
      target_id: board.id,
      subscription_type: SUBSCRIPTION_TYPE.BOARD_SUBSCRIPTION,
      is_enabled: body.isEnabled,
      price: body.price,
    };

    const settingResult = existingSettingResult.data
      ? await supabaseAdmin
          .from('subscription_settings')
          .update(payload)
          .eq('id', existingSettingResult.data.id)
          .select('id')
          .single()
      : await supabaseAdmin.from('subscription_settings').insert(payload).select('id').single();

    if (settingResult.error) {
      console.error(settingResult.error);

      return Response.json({ error: '게시판 구독 설정을 저장하지 못했습니다.' }, { status: 500 });
    }

    const boardSubscriptionUpdateResult = await supabaseAdmin
      .from('boards')
      .update({ is_subscription: body.isEnabled })
      .eq('id', board.id)
      .eq('site_id', site.id);

    if (boardSubscriptionUpdateResult.error) {
      console.error(boardSubscriptionUpdateResult.error);

      return Response.json({ error: '게시판 구독 상태를 저장하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      settingId: settingResult.data.id,
      requiredMinPrice: getRequiredParentSubscriptionPrice(maxSeriesPrice),
      maxSeriesPrice,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '게시판 구독 설정을 저장하지 못했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '게시판 구독 설정을 저장하지 못했습니다.' }, { status: 500 });
  }
}
