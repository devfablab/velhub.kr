import { SUBSCRIPTION_STATUS, SUBSCRIPTION_TYPE, PAYMENT_TARGET_TYPE } from '@/lib/payments/types';
import { getSupabaseAdmin } from '@/lib/supabase';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type BlogSubscriptionRow = {
  status: string;
  current_period_end: string | null;
  expired_at: string | null;
};

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
    .select('status, current_period_end, expired_at')
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

  if (subscription.status !== SUBSCRIPTION_STATUS.TRIALING && subscription.status !== SUBSCRIPTION_STATUS.ACTIVE) {
    return false;
  }

  return new Date(subscription.current_period_end).getTime() > Date.now();
}
