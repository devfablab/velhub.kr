import { isMinor } from '@/lib/identity/age';
import { getChorogonBirthDate } from '@/lib/identity/chorogon';
import { getPastDueGraceDays } from '@/lib/payments/refunds';
import { PAYMENT_TARGET_TYPE, SUBSCRIPTION_STATUS, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import { getSupabaseAdmin } from '@/lib/supabase';
import { MEMBERSHIP_FEATURES, type MembershipFeatureKey } from './catalog';

const featureKeys = new Set<MembershipFeatureKey>(MEMBERSHIP_FEATURES.map((feature) => feature.key));

function isAvailableSubscription(
  subscription: { status: string; current_period_end: string | null },
  { isMinorUser }: { isMinorUser: boolean },
) {
  if (
    subscription.status === SUBSCRIPTION_STATUS.ACTIVE ||
    subscription.status === SUBSCRIPTION_STATUS.TRIALING ||
    subscription.status === SUBSCRIPTION_STATUS.PAST_DUE
  ) {
    return true;
  }

  if (subscription.status !== SUBSCRIPTION_STATUS.CANCELED || !subscription.current_period_end) return false;

  const periodEnd = new Date(subscription.current_period_end).getTime();
  if (periodEnd > Date.now()) return true;

  // 미성년 멤버십은 자동결제가 아닌 1개월 이용권이므로, 이용 종료 뒤에도 7일간 갱신 기회를 제공합니다.
  return isMinorUser && periodEnd + getPastDueGraceDays() * 24 * 60 * 60 * 1000 > Date.now();
}

export async function getMembershipFeatures(stigmaId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const membershipsResult = await supabaseAdmin.from('memberships').select('id').eq('user_id', stigmaId);

  if (membershipsResult.error) {
    throw new Error('멤버십 정보를 확인하지 못했습니다.');
  }

  const membershipIds = membershipsResult.data.map((membership) => membership.id);

  if (membershipIds.length === 0) {
    return new Set<MembershipFeatureKey>();
  }

  const [itemsResult, subscriptionsResult, identityResult] = await Promise.all([
    supabaseAdmin.from('membership_items').select('membership_id, plan_id').in('membership_id', membershipIds),
    supabaseAdmin
      .from('subscriptions')
      .select('target_id, status, current_period_end')
      .eq('subscription_type', SUBSCRIPTION_TYPE.MEMBERSHIP)
      .eq('target_type', PAYMENT_TARGET_TYPE.MEMBERSHIP)
      .in('target_id', membershipIds),
    supabaseAdmin.from('chorogons').select('birth_date, birth_date_dummy').eq('user_id', stigmaId).maybeSingle(),
  ]);

  if (itemsResult.error || subscriptionsResult.error || identityResult.error) {
    throw new Error('멤버십 정보를 확인하지 못했습니다.');
  }

  const isMinorUser = isMinor(getChorogonBirthDate(identityResult.data));

  const availableMembershipIds = new Set(
    subscriptionsResult.data
      .filter((subscription) => isAvailableSubscription(subscription, { isMinorUser }))
      .map((subscription) => subscription.target_id),
  );
  const availablePlanIds = itemsResult.data
    .filter((item) => availableMembershipIds.has(item.membership_id))
    .map((item) => item.plan_id);

  if (availablePlanIds.length === 0) {
    return new Set<MembershipFeatureKey>();
  }

  const plansResult = await supabaseAdmin.from('plans').select('id, plan_key').in('id', availablePlanIds);

  if (plansResult.error) {
    throw new Error('멤버십 정보를 확인하지 못했습니다.');
  }

  return new Set(
    plansResult.data.flatMap((plan) => {
      const key = plan.plan_key.replace(/^all_in_one_/, '') as MembershipFeatureKey;
      return featureKeys.has(key) ? [key] : [];
    }),
  );
}

export async function hasMembershipFeature(stigmaId: string, featureKey: MembershipFeatureKey) {
  return (await getMembershipFeatures(stigmaId)).has(featureKey);
}
