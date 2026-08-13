import { NextResponse } from 'next/server';
import { isMembershipType } from '@/lib/memberships/catalog';
import { getMembershipFeatures } from '@/lib/memberships/features';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';
import { PAYMENT_TARGET_TYPE, SUBSCRIPTION_STATUS, SUBSCRIPTION_TYPE } from '@/lib/payments/types';

export async function GET() {
  const currentStigma = await getCurrentStigma();

  if (!currentStigma) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const [membershipResult, billingMethodResult, membershipFeatures] = await Promise.all([
    supabaseAdmin
      .from('memberships')
      .select('id, created_at, updated_at, membership_type')
      .eq('user_id', currentStigma.stigmaId)
      .order('updated_at', { ascending: false }),
    supabaseAdmin
      .from('subscription_billing_methods')
      .select('id, card_company, card_number_masked, card_type, owner_type, is_default')
      .eq('user_id', currentStigma.stigmaId)
      .order('is_default', { ascending: false }),
    getMembershipFeatures(currentStigma.stigmaId),
  ]);

  if (membershipResult.error || billingMethodResult.error) {
    return NextResponse.json({ message: '멤버십 정보를 불러오지 못했습니다.' }, { status: 500 });
  }

  const memberships = (membershipResult.data ?? []).flatMap((membership) =>
    isMembershipType(membership.membership_type)
      ? [
          {
            id: membership.id as string,
            type: membership.membership_type,
            updatedAt: membership.updated_at as string | null,
          },
        ]
      : [],
  );
  const membershipIds = memberships.map((membership) => membership.id);
  const membershipItemResult = membershipIds.length
    ? await supabaseAdmin.from('membership_items').select('membership_id, plan_id').in('membership_id', membershipIds)
    : { data: [], error: null };
  const subscriptionResult = membershipIds.length
    ? await supabaseAdmin
        .from('subscriptions')
        .select('target_id, status, current_period_end, created_at')
        .eq('subscription_type', SUBSCRIPTION_TYPE.MEMBERSHIP_PLATFORM)
        .eq('target_type', PAYMENT_TARGET_TYPE.MEMBERSHIP)
        .in('target_id', membershipIds)
        .in('status', [
          SUBSCRIPTION_STATUS.TRIALING,
          SUBSCRIPTION_STATUS.ACTIVE,
          SUBSCRIPTION_STATUS.PAST_DUE,
          SUBSCRIPTION_STATUS.CANCELED,
        ])
        .order('created_at', { ascending: false })
    : { data: [], error: null };

  if (membershipItemResult.error || subscriptionResult.error) {
    return NextResponse.json({ message: '멤버십 정보를 불러오지 못했습니다.' }, { status: 500 });
  }

  const planIds = (membershipItemResult.data ?? []).map((item) => item.plan_id as string).filter(Boolean);
  const planResult = planIds.length
    ? await supabaseAdmin.from('plans').select('id, plan_label').in('id', planIds)
    : { data: [], error: null };

  if (planResult.error) {
    return NextResponse.json({ message: '멤버십 정보를 불러오지 못했습니다.' }, { status: 500 });
  }

  const planLabelById = new Map((planResult.data ?? []).map((plan) => [plan.id as string, plan.plan_label as string]));
  const itemLabelsByMembershipId = new Map<string, string[]>();
  const subscriptionByMembershipId = new Map<
    string,
    { status: string; currentPeriodEnd: string | null; createdAt: string | null }
  >();

  for (const subscription of subscriptionResult.data ?? []) {
    const membershipId = subscription.target_id as string;
    if (!subscriptionByMembershipId.has(membershipId)) {
      subscriptionByMembershipId.set(membershipId, {
        status: subscription.status as string,
        currentPeriodEnd: subscription.current_period_end as string | null,
        createdAt: subscription.created_at as string | null,
      });
    }
  }

  for (const item of membershipItemResult.data ?? []) {
    const membershipId = item.membership_id as string;
    const planLabel = planLabelById.get(item.plan_id as string);

    if (!planLabel) continue;

    itemLabelsByMembershipId.set(membershipId, [...(itemLabelsByMembershipId.get(membershipId) ?? []), planLabel]);
  }

  return NextResponse.json({
    features: [...membershipFeatures],
    memberships: memberships.map((membership) => ({
      ...membership,
      itemLabels: itemLabelsByMembershipId.get(membership.id) ?? [],
      subscriptionStatus: subscriptionByMembershipId.get(membership.id)?.status ?? null,
      currentPeriodEnd: subscriptionByMembershipId.get(membership.id)?.currentPeriodEnd ?? null,
      createdAt: subscriptionByMembershipId.get(membership.id)?.createdAt ?? null,
    })),
    billingMethods: (billingMethodResult.data ?? []).map((billingMethod) => ({
      id: billingMethod.id as string,
      cardCompany: billingMethod.card_company as string | null,
      cardNumberMasked: billingMethod.card_number_masked as string | null,
      cardType: billingMethod.card_type as string | null,
      ownerType: billingMethod.owner_type as string | null,
      isDefault: Boolean(billingMethod.is_default),
    })),
  });
}
