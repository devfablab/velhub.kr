import { getPastDueGraceDays } from '@/lib/payments/refunds';
import { SUBSCRIPTION_STATUS, SUBSCRIPTION_TYPE, PAYMENT_TARGET_TYPE } from '@/lib/payments/types';
import { getSupabaseAdmin } from '@/lib/supabase';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type BlogSubscriptionRow = {
  status: string;
  current_period_end: string | null;
  expired_at: string | null;
  past_due_started_at: string | null;
};

type SeriesSubscriptionRow = BlogSubscriptionRow;

type BlogSubscriptionBadgeRow = {
  subscriber_user_id: string;
  badge_months: number | null;
  badge_image_url: string | null;
};

/**
 * 현재 유효한 블로그 구독자에게 표시할 멤버십팬 배지를 구한다.
 * 저장된 배지 URL이 아직 갱신되지 않은 구독 이력도 현재 설정으로 보완한다.
 */
export async function getBlogSubscriptionBadgeUrls({
  supabaseAdmin,
  siteId,
  subscriberIds,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  subscriberIds: string[];
}) {
  const ids = [...new Set(subscriberIds.filter(Boolean))];
  const badgeBySubscriberId = new Map<string, string>();

  if (!ids.length) return badgeBySubscriberId;

  const [subscriptionsResult, badgesResult] = await Promise.all([
    supabaseAdmin
      .from('subscriptions')
      .select('subscriber_user_id, badge_months, badge_image_url')
      .eq('subscription_type', SUBSCRIPTION_TYPE.SUBSCRIPTION_SITE)
      .eq('target_type', PAYMENT_TARGET_TYPE.SITE)
      .eq('target_id', siteId)
      .in('subscriber_user_id', ids)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('blog_subscription_badges')
      .select('subscription_months, image_url')
      .eq('site_id', siteId)
      .order('subscription_months'),
  ]);

  if (subscriptionsResult.error || badgesResult.error) {
    throw new Error('멤버십팬 배지를 불러오지 못했습니다.');
  }

  const badges = badgesResult.data ?? [];
  for (const subscription of (subscriptionsResult.data ?? []) as BlogSubscriptionBadgeRow[]) {
    if (badgeBySubscriberId.has(subscription.subscriber_user_id)) continue;

    if (
      !(await hasValidBlogSubscription({
        supabaseAdmin,
        subscriberId: subscription.subscriber_user_id,
        siteId,
      }))
    ) {
      continue;
    }

    const savedUrl = subscription.badge_image_url?.trim();
    const monthCount = Math.max(0, Number(subscription.badge_months ?? 0));
    const configuredUrl = badges.filter((badge) => badge.subscription_months <= monthCount).at(-1)?.image_url;
    const badgeUrl = savedUrl || configuredUrl || badges[0]?.image_url;

    if (badgeUrl) badgeBySubscriberId.set(subscription.subscriber_user_id, badgeUrl);
  }

  return badgeBySubscriberId;
}

export async function hasValidBlogSubscription({
  supabaseAdmin,
  subscriberId,
  siteId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscriberId: string;
  siteId: string;
}) {
  const subscriptionResult = await supabaseAdmin
    .from('subscriptions')
    .select('status, current_period_end, expired_at, past_due_started_at')
    .eq('subscriber_user_id', subscriberId)
    .eq('subscription_type', SUBSCRIPTION_TYPE.SUBSCRIPTION_SITE)
    .eq('target_type', PAYMENT_TARGET_TYPE.SITE)
    .eq('target_id', siteId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (subscriptionResult.error) {
    throw new Error('블로그 구독 상태를 확인하지 못했습니다.');
  }

  const subscription = ((subscriptionResult.data ?? [])[0] as BlogSubscriptionRow | undefined) ?? null;

  if (!subscription || subscription.expired_at || !subscription.current_period_end) {
    return false;
  }

  const now = Date.now();
  const periodEnd = new Date(subscription.current_period_end).getTime();

  if (subscription.status === SUBSCRIPTION_STATUS.TRIALING || subscription.status === SUBSCRIPTION_STATUS.ACTIVE) {
    return periodEnd > now;
  }

  // 자동결제 오류는 결제 수단을 고칠 수 있도록 7일간만 구독 권한을 유지합니다.
  if (subscription.status === SUBSCRIPTION_STATUS.PAST_DUE && subscription.past_due_started_at) {
    const startedAt = new Date(subscription.past_due_started_at).getTime();
    return Number.isFinite(startedAt) && startedAt + getPastDueGraceDays() * 24 * 60 * 60 * 1000 > now;
  }

  // 환불 없이 해지한 구독은 이미 결제한 회차가 끝날 때까지 이용할 수 있습니다.
  return subscription.status === SUBSCRIPTION_STATUS.CANCELED && periodEnd > now;
}

export async function hasValidSeriesSubscription({
  supabaseAdmin,
  subscriberId,
  seriesId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscriberId: string;
  seriesId: string;
}) {
  const subscriptionResult = await supabaseAdmin
    .from('subscriptions')
    .select('status, current_period_end, expired_at')
    .eq('subscriber_user_id', subscriberId)
    .eq('subscription_type', SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES)
    .eq('target_type', PAYMENT_TARGET_TYPE.SERIES)
    .eq('target_id', seriesId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (subscriptionResult.error) {
    throw new Error('연재 구독 상태를 확인하지 못했습니다.');
  }

  const subscription = ((subscriptionResult.data ?? [])[0] as SeriesSubscriptionRow | undefined) ?? null;

  if (!subscription || subscription.expired_at || !subscription.current_period_end) {
    return false;
  }

  if (subscription.status !== SUBSCRIPTION_STATUS.TRIALING && subscription.status !== SUBSCRIPTION_STATUS.ACTIVE) {
    return false;
  }

  return new Date(subscription.current_period_end).getTime() > Date.now();
}
