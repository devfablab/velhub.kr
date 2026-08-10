import { NextResponse } from 'next/server';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

const MEMBERSHIP_TYPE_VALUES = ['owner', 'creator', 'all_in_one', 'affetto'] as const;

type MembershipType = (typeof MEMBERSHIP_TYPE_VALUES)[number];

function isMembershipType(value: unknown): value is MembershipType {
  return typeof value === 'string' && MEMBERSHIP_TYPE_VALUES.includes(value as MembershipType);
}

export async function GET() {
  const currentStigma = await getCurrentStigma();

  if (!currentStigma) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const [membershipResult, billingMethodResult] = await Promise.all([
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

  if (membershipItemResult.error) {
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

  for (const item of membershipItemResult.data ?? []) {
    const membershipId = item.membership_id as string;
    const planLabel = planLabelById.get(item.plan_id as string);

    if (!planLabel) continue;

    itemLabelsByMembershipId.set(membershipId, [...(itemLabelsByMembershipId.get(membershipId) ?? []), planLabel]);
  }

  return NextResponse.json({
    memberships: memberships.map((membership) => ({
      ...membership,
      itemLabels: itemLabelsByMembershipId.get(membership.id) ?? [],
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
