import {
  PAYMENT_STATUS,
  PAYMENT_TARGET_TYPE,
  PAYMENT_TYPE,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TYPE,
} from '@/lib/payments/types';
import {
  SERIES_SUBSCRIPTION_MIN_PRICE,
  getMaxAllowedSeriesSubscriptionPrice,
  validateSeriesPriceAgainstParentPrice,
} from '@/lib/payments/subscriptionPrice';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

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

type BoardSeriesRow = {
  id: string;
  site_id: string;
  board_id: string;
  series_key: string;
  series_label: string;
};

type SubscriptionSettingRow = {
  id: string;
  target_id: string;
  is_enabled: boolean;
  price: number;
};

type ParentSubscriptionSettingRow = {
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
  if (status === SUBSCRIPTION_STATUS.ACTIVE) {
    return '유지 중';
  }

  if (status === SUBSCRIPTION_STATUS.PAST_DUE) {
    return '결제 유예 중';
  }

  if (status === SUBSCRIPTION_STATUS.SCHEDULED_CANCEL) {
    return '취소 예정';
  }

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

  const session = await verifySession({
    siteId: site.id,
  });

  if (session.case !== 'staff') {
    return {
      response: Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 }),
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

async function getBlogMembershipPrice({
  supabaseAdmin,
  siteId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
}) {
  const settingResult = await supabaseAdmin
    .from('subscription_settings')
    .select('target_id, is_enabled, price')
    .eq('target_type', PAYMENT_TARGET_TYPE.BLOG)
    .eq('target_id', siteId)
    .eq('subscription_type', SUBSCRIPTION_TYPE.BLOG_MEMBERSHIP)
    .eq('is_enabled', true)
    .maybeSingle();

  if (settingResult.error) {
    throw new Error('블로그 멤버십 설정을 확인하지 못했습니다.');
  }

  const setting = settingResult.data as ParentSubscriptionSettingRow | null;

  return setting?.price ?? 0;
}

async function getBoardSubscriptionPrice({
  supabaseAdmin,
  boardId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  boardId: string;
}) {
  const settingResult = await supabaseAdmin
    .from('subscription_settings')
    .select('target_id, is_enabled, price')
    .eq('target_type', PAYMENT_TARGET_TYPE.BOARD)
    .eq('target_id', boardId)
    .eq('subscription_type', SUBSCRIPTION_TYPE.BOARD_SUBSCRIPTION)
    .eq('is_enabled', true)
    .maybeSingle();

  if (settingResult.error) {
    throw new Error('게시판 구독 설정을 확인하지 못했습니다.');
  }

  const setting = settingResult.data as ParentSubscriptionSettingRow | null;

  return setting?.price ?? 0;
}

async function getParentSubscriptionPrice({
  supabaseAdmin,
  site,
  boardId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  site: SiteRow;
  boardId: string;
}) {
  if (site.site_type === 'blog') {
    return getBlogMembershipPrice({
      supabaseAdmin,
      siteId: site.id,
    });
  }

  return getBoardSubscriptionPrice({
    supabaseAdmin,
    boardId,
  });
}

async function getParentPriceByBoardId({
  supabaseAdmin,
  site,
  boardIds,
}: {
  supabaseAdmin: SupabaseAdminClient;
  site: SiteRow;
  boardIds: string[];
}) {
  const result = new Map<string, number>();

  if (site.site_type === 'blog') {
    const membershipPrice = await getBlogMembershipPrice({
      supabaseAdmin,
      siteId: site.id,
    });

    for (const boardId of boardIds) {
      result.set(boardId, membershipPrice);
    }

    return result;
  }

  if (!boardIds.length) {
    return result;
  }

  const settingsResult = await supabaseAdmin
    .from('subscription_settings')
    .select('target_id, is_enabled, price')
    .eq('target_type', PAYMENT_TARGET_TYPE.BOARD)
    .eq('subscription_type', SUBSCRIPTION_TYPE.BOARD_SUBSCRIPTION)
    .eq('is_enabled', true)
    .in('target_id', boardIds);

  if (settingsResult.error) {
    throw new Error('게시판 구독 설정을 확인하지 못했습니다.');
  }

  const settings = (settingsResult.data ?? []) as ParentSubscriptionSettingRow[];

  for (const setting of settings) {
    result.set(setting.target_id, setting.price);
  }

  return result;
}

async function getSubscriptionEnabledSeriesCount({
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
    .eq('board_id', boardId)
    .eq('is_subscription', true);

  if (seriesCountResult.error) {
    throw new Error('구독 연재 개수를 확인하지 못했습니다.');
  }

  return seriesCountResult.count ?? 0;
}

async function disableBoardSubscriptionIfNeeded({
  supabaseAdmin,
  siteId,
  boardId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  boardId: string;
}) {
  const subscriptionEnabledSeriesCount = await getSubscriptionEnabledSeriesCount({
    supabaseAdmin,
    siteId,
    boardId,
  });

  if (subscriptionEnabledSeriesCount >= 2) {
    return {
      boardSubscriptionDisabled: false,
      subscriptionEnabledSeriesCount,
    };
  }

  const settingUpdateResult = await supabaseAdmin
    .from('subscription_settings')
    .update({
      is_enabled: false,
    })
    .eq('target_type', PAYMENT_TARGET_TYPE.BOARD)
    .eq('target_id', boardId)
    .eq('subscription_type', SUBSCRIPTION_TYPE.BOARD_SUBSCRIPTION);

  if (settingUpdateResult.error) {
    throw new Error('게시판 구독 설정을 자동 해제하지 못했습니다.');
  }

  return {
    boardSubscriptionDisabled: true,
    subscriptionEnabledSeriesCount,
  };
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

    const boardsResult =
      site.site_type === 'blog'
        ? await supabaseAdmin
            .from('boards')
            .select('id, board_key, board_label, site_id')
            .eq('site_id', site.id)
            .eq('board_key', 'b')
            .order('board_label', { ascending: true })
        : await supabaseAdmin
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

    const parentPriceByBoardId = await getParentPriceByBoardId({
      supabaseAdmin,
      site,
      boardIds,
    });

    const seriesResult = boardIds.length
      ? await supabaseAdmin
          .from('board_series')
          .select('id, site_id, board_id, series_key, series_label')
          .eq('site_id', site.id)
          .in('board_id', boardIds)
          .order('series_label', { ascending: true })
      : { data: [], error: null };

    if (seriesResult.error) {
      console.error(seriesResult.error);

      return Response.json({ error: '연재 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const seriesList = (seriesResult.data ?? []) as BoardSeriesRow[];
    const seriesIds = seriesList.map((series) => series.id);

    const settingsResult = seriesIds.length
      ? await supabaseAdmin
          .from('subscription_settings')
          .select('id, target_id, is_enabled, price')
          .eq('target_type', PAYMENT_TARGET_TYPE.SERIES)
          .eq('subscription_type', SUBSCRIPTION_TYPE.SERIES_SUBSCRIPTION)
          .in('target_id', seriesIds)
      : { data: [], error: null };

    if (settingsResult.error) {
      console.error(settingsResult.error);

      return Response.json({ error: '연재 구독 설정을 불러오지 못했습니다.' }, { status: 500 });
    }

    const settings = (settingsResult.data ?? []) as SubscriptionSettingRow[];
    const settingBySeriesId = new Map(settings.map((setting) => [setting.target_id, setting]));

    const subscriptionsResult = seriesIds.length
      ? await supabaseAdmin
          .from('subscriptions')
          .select('id, subscriber_user_id, target_id, status, price, created_at')
          .eq('subscription_type', SUBSCRIPTION_TYPE.SERIES_SUBSCRIPTION)
          .eq('target_type', PAYMENT_TARGET_TYPE.SERIES)
          .in('target_id', seriesIds)
          .order('created_at', { ascending: false })
      : { data: [], error: null };

    if (subscriptionsResult.error) {
      console.error(subscriptionsResult.error);

      return Response.json({ error: '연재 구독자 정보를 불러오지 못했습니다.' }, { status: 500 });
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

    const paymentsResult = seriesIds.length
      ? await supabaseAdmin
          .from('payments')
          .select('id, buyer_user_id, target_id, amount, approved_at, created_at')
          .eq('payment_type', PAYMENT_TYPE.SERIES_SUBSCRIPTION)
          .eq('target_type', PAYMENT_TARGET_TYPE.SERIES)
          .eq('status', PAYMENT_STATUS.PAID)
          .in('target_id', seriesIds)
      : { data: [], error: null };

    if (paymentsResult.error) {
      console.error(paymentsResult.error);

      return Response.json({ error: '연재 구독 결제 정보를 불러오지 못했습니다.' }, { status: 500 });
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

    const seriesByBoardId = new Map<string, BoardSeriesRow[]>();

    for (const series of seriesList) {
      const currentSeriesList = seriesByBoardId.get(series.board_id) ?? [];
      currentSeriesList.push(series);
      seriesByBoardId.set(series.board_id, currentSeriesList);
    }

    const subscriptionsBySeriesId = new Map<string, SubscriptionRow[]>();

    for (const subscription of latestSubscriptions) {
      const currentSubscriptions = subscriptionsBySeriesId.get(subscription.target_id) ?? [];
      currentSubscriptions.push(subscription);
      subscriptionsBySeriesId.set(subscription.target_id, currentSubscriptions);
    }

    const boardsWithSeries = boards
      .map((board) => {
        const boardSeriesList = seriesByBoardId.get(board.id) ?? [];
        const parentPrice = parentPriceByBoardId.get(board.id) ?? 0;
        const maxAllowedSeriesPrice = getMaxAllowedSeriesSubscriptionPrice(parentPrice);

        return {
          id: board.id,
          boardKey: board.board_key,
          boardLabel: board.board_label,
          parentPrice,
          maxAllowedSeriesPrice,
          series: boardSeriesList.map((series) => {
            const setting = settingBySeriesId.get(series.id);
            const seriesSubscriptions = subscriptionsBySeriesId.get(series.id) ?? [];

            return {
              id: series.id,
              seriesKey: series.series_key,
              seriesLabel: series.series_label,
              setting: setting
                ? {
                    id: setting.id,
                    isEnabled: setting.is_enabled,
                    price: setting.price,
                    minPrice: SERIES_SUBSCRIPTION_MIN_PRICE,
                    maxAllowedPrice: maxAllowedSeriesPrice,
                    parentPrice,
                  }
                : {
                    id: null,
                    isEnabled: false,
                    price: SERIES_SUBSCRIPTION_MIN_PRICE,
                    minPrice: SERIES_SUBSCRIPTION_MIN_PRICE,
                    maxAllowedPrice: maxAllowedSeriesPrice,
                    parentPrice,
                  },
              subscribers: seriesSubscriptions.map((subscription) => {
                const stigmaId = stigmaIdByParticleId.get(subscription.subscriber_user_id);
                const paymentStats = paymentStatsByKey.get(
                  `${subscription.target_id}:${subscription.subscriber_user_id}`,
                );

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
        };
      })
      .filter((board) => board.series.length > 0);

    return Response.json({
      site: {
        id: site.id,
        siteKey: site.site_key,
        siteLabel: site.site_label,
        siteType: site.site_type,
      },
      boards: boardsWithSeries,
      emptyMessage: site.site_type === 'blog' ? '연재가 설정되지 않았습니다' : '연재 설정된 게시판이 없습니다',
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '연재 구독 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '연재 구독 정보를 불러오지 못했습니다.' }, { status: 500 });
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
      seriesId?: string;
      isEnabled?: boolean;
      price?: number;
    };

    const seriesId = normalizeText(body.seriesId);

    if (!seriesId) {
      return Response.json({ error: '연재 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    if (typeof body.isEnabled !== 'boolean') {
      return Response.json({ error: '연재 구독 사용 여부가 올바르지 않습니다.' }, { status: 400 });
    }

    if (typeof body.price !== 'number') {
      return Response.json({ error: '연재 구독 금액이 올바르지 않습니다.' }, { status: 400 });
    }

    const siteAndSession = await getSiteAndSession(siteName);

    if (siteAndSession.response || !siteAndSession.site) {
      return siteAndSession.response;
    }

    const { site, supabaseAdmin } = siteAndSession;

    const seriesResult = await supabaseAdmin
      .from('board_series')
      .select('id, site_id, board_id, series_key, series_label')
      .eq('id', seriesId)
      .eq('site_id', site.id)
      .maybeSingle();

    if (seriesResult.error) {
      console.error(seriesResult.error);

      return Response.json({ error: '연재 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!seriesResult.data) {
      return Response.json({ error: '연재 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const series = seriesResult.data as BoardSeriesRow;

    const boardResult = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, site_id')
      .eq('id', series.board_id)
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

    if (site.site_type === 'blog' && board.board_key !== 'b') {
      return Response.json({ error: '블로그 연재 구독 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    if (site.site_type === 'community' && (board.board_key === 'b' || board.board_key === 'p')) {
      return Response.json({ error: '해당 게시판의 연재는 구독을 사용할 수 없습니다.' }, { status: 400 });
    }

    const parentPrice = await getParentSubscriptionPrice({
      supabaseAdmin,
      site,
      boardId: board.id,
    });

    if (body.isEnabled) {
      const priceValidation = validateSeriesPriceAgainstParentPrice(body.price, parentPrice);

      if (!priceValidation.ok) {
        return Response.json({ error: priceValidation.message }, { status: 400 });
      }
    }

    const existingSettingResult = await supabaseAdmin
      .from('subscription_settings')
      .select('id')
      .eq('target_type', PAYMENT_TARGET_TYPE.SERIES)
      .eq('target_id', series.id)
      .eq('subscription_type', SUBSCRIPTION_TYPE.SERIES_SUBSCRIPTION)
      .maybeSingle();

    if (existingSettingResult.error) {
      console.error(existingSettingResult.error);

      return Response.json({ error: '연재 구독 설정을 확인하지 못했습니다.' }, { status: 500 });
    }

    const payload = {
      target_type: PAYMENT_TARGET_TYPE.SERIES,
      target_id: series.id,
      subscription_type: SUBSCRIPTION_TYPE.SERIES_SUBSCRIPTION,
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

      return Response.json({ error: '연재 구독 설정을 저장하지 못했습니다.' }, { status: 500 });
    }

    const seriesSubscriptionUpdateResult = await supabaseAdmin
      .from('board_series')
      .update({
        is_subscription: body.isEnabled,
      })
      .eq('id', series.id)
      .eq('site_id', site.id);

    if (seriesSubscriptionUpdateResult.error) {
      console.error(seriesSubscriptionUpdateResult.error);

      return Response.json({ error: '연재 구독 상태를 저장하지 못했습니다.' }, { status: 500 });
    }

    const boardSubscriptionResult =
      site.site_type === 'community' && !body.isEnabled
        ? await disableBoardSubscriptionIfNeeded({
            supabaseAdmin,
            siteId: site.id,
            boardId: board.id,
          })
        : {
            boardSubscriptionDisabled: false,
            subscriptionEnabledSeriesCount: await getSubscriptionEnabledSeriesCount({
              supabaseAdmin,
              siteId: site.id,
              boardId: board.id,
            }),
          };

    return Response.json({
      ok: true,
      settingId: settingResult.data.id,
      parentPrice,
      maxAllowedPrice: getMaxAllowedSeriesSubscriptionPrice(parentPrice),
      boardSubscriptionDisabled: boardSubscriptionResult.boardSubscriptionDisabled,
      subscriptionEnabledSeriesCount: boardSubscriptionResult.subscriptionEnabledSeriesCount,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '연재 구독 설정을 저장하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '연재 구독 설정을 저장하지 못했습니다.' }, { status: 500 });
  }
}
