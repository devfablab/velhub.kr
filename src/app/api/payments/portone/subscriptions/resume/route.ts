import { PAYMENT_TARGET_TYPE, SUBSCRIPTION_STATUS, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type SubscriptionTargetType = 'board' | 'series';

type ResumeSubscriptionBody = {
  siteName?: string;
  boardName?: string;
  targetType?: string;
  seriesName?: string | null;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
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
    return SUBSCRIPTION_TYPE.SUBSCRIPTION_BOARD;
  }

  return SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES;
}

function getPaymentTargetType(targetType: SubscriptionTargetType) {
  if (targetType === 'board') {
    return PAYMENT_TARGET_TYPE.BOARD;
  }

  return PAYMENT_TARGET_TYPE.SERIES;
}

async function getSubscriptionTarget({
  supabaseAdmin,
  siteId,
  boardName,
  targetType,
  seriesName,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  boardName: string;
  targetType: SubscriptionTargetType;
  seriesName: string;
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

  const board = boardResult.data as BoardRow;

  if (targetType === 'board') {
    return {
      targetId: board.id,
      targetLabel: board.board_label,
    };
  }

  if (!seriesName) {
    throw new Error('seriesName이 유효하지 않습니다.');
  }

  const seriesResult = await supabaseAdmin
    .from('board_series')
    .select('id, series_key, series_label')
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
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ResumeSubscriptionBody;
    const siteName = normalizeText(body.siteName).toLowerCase();
    const boardName = normalizeText(body.boardName).toLowerCase();
    const targetType = getTargetType(normalizeText(body.targetType));
    const seriesName = normalizeText(body.seriesName).toLowerCase();

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

    const session = await verifySession({
      siteId: site.id,
    });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const subscriptionTarget = await getSubscriptionTarget({
      supabaseAdmin,
      siteId: site.id,
      boardName,
      targetType,
      seriesName,
    });

    const subscriptionType = getSubscriptionType(targetType);
    const paymentTargetType = getPaymentTargetType(targetType);
    const now = new Date();
    const nowText = now.toISOString();

    const subscriptionResult = await supabaseAdmin
      .from('subscriptions')
      .select('id, status, current_period_end, next_billing_at, canceled_at, expired_at')
      .eq('site_id', site.id)
      .eq('subscriber_user_id', session.authUserId)
      .eq('subscription_type', subscriptionType)
      .eq('target_type', paymentTargetType)
      .eq('target_id', subscriptionTarget.targetId)
      .in('status', [SUBSCRIPTION_STATUS.TRIALING, SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PAST_DUE])
      .order('created_at', { ascending: false })
      .limit(1);

    if (subscriptionResult.error) {
      console.error(subscriptionResult.error);

      return Response.json({ error: '구독 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const subscription = ((subscriptionResult.data ?? [])[0] as SubscriptionRow | undefined) ?? null;

    if (!subscription) {
      return Response.json({ error: '취소 철회할 구독을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!subscription.canceled_at) {
      return Response.json({ error: '취소 예약된 구독이 아닙니다.' }, { status: 400 });
    }

    if (subscription.expired_at) {
      return Response.json({ error: '이미 종료된 구독입니다. 다시 결제해야 합니다.' }, { status: 400 });
    }

    if (new Date(subscription.current_period_end).getTime() <= now.getTime()) {
      return Response.json({ error: '이미 현재 이용 기간이 종료되었습니다. 다시 결제해야 합니다.' }, { status: 400 });
    }

    const subscriptionUpdateResult = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        canceled_at: null,
        next_billing_at: subscription.current_period_end,
        updated_at: nowText,
      })
      .eq('id', subscription.id);

    if (subscriptionUpdateResult.error) {
      console.error(subscriptionUpdateResult.error);

      return Response.json({ error: '구독 취소를 철회하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      mode: 'resume_scheduled_cancel',
      nextBillingAt: subscription.current_period_end,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '구독 취소 철회에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '구독 취소 철회에 실패했습니다.' }, { status: 500 });
  }
}
