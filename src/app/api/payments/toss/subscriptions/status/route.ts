import { PAYMENT_TARGET_TYPE, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SubscriptionTargetType = 'board' | 'series';

type SubscriptionStatus = 'none' | 'active' | 'scheduled_cancel' | 'canceled' | 'expired' | 'past_due';

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
};

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string | null;
  is_subscription: boolean | null;
};

type SeriesRow = {
  id: string;
  series_key: string;
  series_label: string | null;
  is_subscription: boolean | null;
};

type SubscriptionSettingRow = {
  price: number;
  is_enabled: boolean;
};

type SubscriptionRow = {
  id: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
  current_period_end: string;
  next_billing_at: string | null;
  canceled_at: string | null;
  expired_at: string | null;
};

function getTargetType(value: string): SubscriptionTargetType | null {
  if (value === 'board' || value === 'series') {
    return value;
  }

  return null;
}

function getSubscriptionType(targetType: SubscriptionTargetType) {
  if (targetType === 'board') {
    return SUBSCRIPTION_TYPE.BOARD_SUBSCRIPTION;
  }

  return SUBSCRIPTION_TYPE.SERIES_SUBSCRIPTION;
}

function getPaymentTargetType(targetType: SubscriptionTargetType) {
  if (targetType === 'board') {
    return PAYMENT_TARGET_TYPE.BOARD;
  }

  return PAYMENT_TARGET_TYPE.SERIES;
}

function getSettingSubscriptionType(targetType: SubscriptionTargetType) {
  if (targetType === 'board') {
    return 'board_subscription';
  }

  return 'series_subscription';
}

function getSubscriptionStatus(subscription: SubscriptionRow | null): SubscriptionStatus {
  if (!subscription) {
    return 'none';
  }

  if (subscription.status === 'expired') {
    return 'expired';
  }

  if (subscription.status === 'canceled') {
    return 'canceled';
  }

  if (subscription.status === 'past_due') {
    return 'past_due';
  }

  if (subscription.canceled_at && !subscription.expired_at) {
    const currentPeriodEndTime = new Date(subscription.current_period_end).getTime();

    if (currentPeriodEndTime > Date.now()) {
      return 'scheduled_cancel';
    }

    return 'expired';
  }

  if (subscription.status === 'trialing' || subscription.status === 'active') {
    return 'active';
  }

  return 'none';
}

async function getTargetInfo({
  supabaseAdmin,
  siteId,
  boardName,
  targetType,
  seriesName,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  siteId: string;
  boardName: string;
  targetType: SubscriptionTargetType;
  seriesName: string;
}) {
  const boardResult = await supabaseAdmin
    .from('boards')
    .select('id, board_key, board_label, is_subscription')
    .eq('site_id', siteId)
    .eq('board_key', boardName)
    .maybeSingle();

  if (boardResult.error) {
    throw new Error('게시판 정보를 확인하지 못했습니다.');
  }

  if (!boardResult.data) {
    throw new Error('게시판 정보를 찾을 수 없습니다.');
  }

  const board = boardResult.data as BoardRow;

  if (targetType === 'board') {
    return {
      targetId: board.id,
      targetLabel: board.board_label,
      isSubscriptionTarget: Boolean(board.is_subscription),
    };
  }

  if (!seriesName) {
    throw new Error('seriesName이 유효하지 않습니다.');
  }

  const seriesResult = await supabaseAdmin
    .from('board_series')
    .select('id, series_key, series_label, is_subscription')
    .eq('site_id', siteId)
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

  return {
    targetId: series.id,
    targetLabel: series.series_label,
    isSubscriptionTarget: Boolean(series.is_subscription),
  };
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const boardName = normalizeText(requestUrl.searchParams.get('boardName')).toLowerCase();
    const targetType = getTargetType(normalizeText(requestUrl.searchParams.get('targetType')));
    const seriesName = normalizeText(requestUrl.searchParams.get('seriesName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!boardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!targetType) {
      return Response.json({ error: 'targetType이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const siteResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label')
      .eq('site_key', siteName)
      .maybeSingle();

    if (siteResult.error) {
      console.error(siteResult.error);

      return Response.json({ error: '사이트 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!siteResult.data) {
      return Response.json({ error: '사이트 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const site = siteResult.data as SiteRow;

    const targetInfo = await getTargetInfo({
      supabaseAdmin,
      siteId: site.id,
      boardName,
      targetType,
      seriesName,
    });

    if (!targetInfo.isSubscriptionTarget) {
      return Response.json({
        isEnabled: false,
        price: null,
        subscriptionStatus: 'none',
      });
    }

    const settingResult = await supabaseAdmin
      .from('subscription_settings')
      .select('price, is_enabled')
      .eq('target_type', targetType)
      .eq('target_id', targetInfo.targetId)
      .eq('subscription_type', getSettingSubscriptionType(targetType))
      .maybeSingle();

    if (settingResult.error) {
      console.error(settingResult.error);

      return Response.json({ error: '구독 설정을 확인하지 못했습니다.' }, { status: 500 });
    }

    const setting = (settingResult.data as SubscriptionSettingRow | null) ?? null;

    if (!setting?.is_enabled) {
      return Response.json({
        isEnabled: false,
        price: null,
        subscriptionStatus: 'none',
      });
    }

    const session = await verifySession({ siteId: site.id });

    if (!session.authUserId) {
      return Response.json({
        isEnabled: true,
        price: setting.price,
        subscriptionStatus: 'none',
      });
    }

    const subscriptionResult = await supabaseAdmin
      .from('subscriptions')
      .select('id, status, current_period_end, next_billing_at, canceled_at, expired_at')
      .eq('subscriber_user_id', session.authUserId)
      .eq('subscription_type', getSubscriptionType(targetType))
      .eq('target_type', getPaymentTargetType(targetType))
      .eq('target_id', targetInfo.targetId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionResult.error) {
      console.error(subscriptionResult.error);

      return Response.json({ error: '구독 상태를 확인하지 못했습니다.' }, { status: 500 });
    }

    const subscription = (subscriptionResult.data as SubscriptionRow | null) ?? null;

    return Response.json({
      isEnabled: true,
      price: setting.price,
      subscriptionStatus: getSubscriptionStatus(subscription),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '구독 상태를 확인하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '구독 상태를 확인하지 못했습니다.' }, { status: 500 });
  }
}
