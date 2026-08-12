import { NextResponse } from 'next/server';
import { encrypt } from '@/lib/encryption/encrypt';
import { createNextMonthlyBillingPeriod, getBillingAnchorDay } from '@/lib/payments/billingPeriod';
import {
  assertPortOnePaidPayment,
  cancelPortOnePayment,
  createPortOnePaymentKey,
  getCurrentPortOneProvider,
  getPortOnePaidAt,
  getPortOnePayment,
  getPortOnePaymentFromResponse,
  getPortOnePaymentTransactionNo,
  requestPortOneBillingPayment,
} from '@/lib/payments/portone';
import { PAYMENT_METHOD, PAYMENT_STATUS, PAYMENT_TARGET_TYPE, PAYMENT_TYPE, REFUND_POLICY, SUBSCRIPTION_STATUS, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import { createPaymentOrderNo as createOrderNo } from '@/lib/payments/orderNo';
import { getMembershipPlanKey, getMembershipPrice, type MembershipFeatureKey } from '@/lib/memberships/catalog';
import { getMembershipFeatures } from '@/lib/memberships/features';
import { createCustomerKey } from '@/lib/payments/customer';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

const MEMBERSHIP_TYPE_VALUES = ['owner', 'creator', 'all_in_one', 'affetto'] as const;

type MembershipType = (typeof MEMBERSHIP_TYPE_VALUES)[number];
type PaidMembershipType = MembershipType;

const FEATURE_KEYS = [
  'owner_lounge',
  'owner_domain',
  'owner_unlimited_sites',
  'creator_lounge',
  'creator_branding',
  'creator_posts',
  'affetto_hide_ads',
  'affetto_favorite_folders',
  'affetto_my_posts',
] as const satisfies readonly MembershipFeatureKey[];

type MembershipPurchase = {
  type: PaidMembershipType;
  featureKeys: MembershipFeatureKey[];
};

function isMembershipType(value: unknown): value is MembershipType {
  return typeof value === 'string' && MEMBERSHIP_TYPE_VALUES.includes(value as MembershipType);
}

function isFeatureKey(value: unknown): value is MembershipFeatureKey {
  return typeof value === 'string' && FEATURE_KEYS.includes(value as MembershipFeatureKey);
}

function getFeatureGroup(key: MembershipFeatureKey) {
  return key.split('_')[0];
}

function isValidPurchase({ type, featureKeys }: MembershipPurchase) {
  if (!featureKeys.length || featureKeys.some((key, index) => featureKeys.indexOf(key) !== index)) return false;
  if (type === 'owner') return featureKeys.every((key) => getFeatureGroup(key) === 'owner');
  if (type === 'creator') return featureKeys.every((key) => getFeatureGroup(key) === 'creator');
  if (type === 'affetto') return featureKeys.every((key) => getFeatureGroup(key) === 'affetto');

  const ownerCount = featureKeys.filter((key) => getFeatureGroup(key) === 'owner').length;
  const creatorCount = featureKeys.filter((key) => getFeatureGroup(key) === 'creator').length;
  return featureKeys.every((key) => ['owner', 'creator'].includes(getFeatureGroup(key))) && ownerCount >= 2 && creatorCount >= 2;
}

async function requestMembershipBilling({
  billingKey,
  customerKey,
  amount,
  orderNo,
  orderName,
}: {
  billingKey: string;
  customerKey: string;
  amount: number;
  orderNo: string;
  orderName: string;
}) {
  const paymentKey = createPortOnePaymentKey(orderNo);
  await requestPortOneBillingPayment({
    paymentId: paymentKey,
    billingKey,
    customerId: customerKey,
    amount,
    orderName,
  });
  const payment = getPortOnePaymentFromResponse(await getPortOnePayment(paymentKey));
  assertPortOnePaidPayment(payment);
  return { paymentKey, payment };
}

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
        .in('status', [SUBSCRIPTION_STATUS.TRIALING, SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PAST_DUE, SUBSCRIPTION_STATUS.CANCELED])
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
  const subscriptionByMembershipId = new Map<string, { status: string; currentPeriodEnd: string | null }>();

  for (const subscription of subscriptionResult.data ?? []) {
    const membershipId = subscription.target_id as string;
    if (!subscriptionByMembershipId.has(membershipId)) {
      subscriptionByMembershipId.set(membershipId, {
        status: subscription.status as string,
        currentPeriodEnd: subscription.current_period_end as string | null,
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

export async function POST(request: Request) {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { purchases?: unknown; billingMethodId?: unknown } | null;
  const purchases = Array.isArray(body?.purchases) ? body.purchases : [];
  const billingMethodId = typeof body?.billingMethodId === 'string' ? body.billingMethodId : '';
  const normalizedPurchases: MembershipPurchase[] = purchases.flatMap((purchase) => {
    if (!purchase || typeof purchase !== 'object') return [];
    const value = purchase as { type?: unknown; featureKeys?: unknown };
    const featureKeys = Array.isArray(value.featureKeys) ? value.featureKeys.filter(isFeatureKey) : [];
    return isMembershipType(value.type) ? [{ type: value.type, featureKeys }] : [];
  });

  if (!billingMethodId || !normalizedPurchases.length || normalizedPurchases.some((purchase) => !isValidPurchase(purchase))) {
    return NextResponse.json({ error: '선택한 멤버십 구성이 올바르지 않습니다.' }, { status: 400 });
  }

  const hasAllInOne = normalizedPurchases.some((purchase) => purchase.type === 'all_in_one');
  if (hasAllInOne && normalizedPurchases.some((purchase) => purchase.type === 'owner' || purchase.type === 'creator')) {
    return NextResponse.json({ error: '올인원 멤버십은 다른 창작자 멤버십과 함께 선택할 수 없습니다.' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const identityResult = await supabaseAdmin
    .from('chorogons')
    .select('id')
    .eq('user_id', currentStigma.stigmaId)
    .maybeSingle();

  if (identityResult.error) {
    return NextResponse.json({ error: '본인인증 정보를 확인하지 못했습니다.' }, { status: 500 });
  }

  const [billingMethodResult, existingMembershipResult, ownedSiteResult, authorResult] = await Promise.all([
    supabaseAdmin
      .from('subscription_billing_methods')
      .select('id, customer_key, billing_key')
      .eq('id', billingMethodId)
      .eq('user_id', currentStigma.stigmaId)
      .eq('provider', getCurrentPortOneProvider())
      .maybeSingle(),
    supabaseAdmin
      .from('memberships')
      .select('id, membership_type')
      .eq('user_id', currentStigma.stigmaId),
    supabaseAdmin
      .from('rhizomes')
      .select('id')
      .eq('owner_id', currentStigma.stigmaId)
      .eq('is_shutdown', false)
      .limit(1),
    identityResult.data?.id
      ? supabaseAdmin
          .from('chorogons_banque')
          .select('id, is_author')
          .eq('chorogon_id', identityResult.data.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (billingMethodResult.error || !billingMethodResult.data) return NextResponse.json({ error: '선택한 결제수단을 확인하지 못했습니다.' }, { status: 400 });
  if (existingMembershipResult.error || ownedSiteResult.error || authorResult.error) return NextResponse.json({ error: '멤버십 정보를 확인하지 못했습니다.' }, { status: 500 });

  const existingTypes = new Set((existingMembershipResult.data ?? []).map((membership) => membership.membership_type));
  if (normalizedPurchases.some((purchase) => existingTypes.has(purchase.type))) {
    return NextResponse.json({ error: '이미 이용 중인 멤버십이 포함되어 있습니다.' }, { status: 400 });
  }

  const isUsingAllInOne = existingTypes.has('all_in_one');
  const isUsingIndividualCreatorMembership = existingTypes.has('owner') || existingTypes.has('creator');
  if ((hasAllInOne && isUsingIndividualCreatorMembership) || (!hasAllInOne && isUsingAllInOne)) {
    return NextResponse.json({ error: '올인원 멤버십과 오너·크리에이터 멤버십은 함께 이용할 수 없습니다.' }, { status: 400 });
  }

  const needsOwner = normalizedPurchases.some((purchase) => purchase.type === 'owner' || purchase.type === 'all_in_one');
  const needsCreator = normalizedPurchases.some((purchase) => purchase.type === 'creator' || purchase.type === 'all_in_one');
  if (needsOwner && !(ownedSiteResult.data ?? []).length) return NextResponse.json({ error: '운영 중인 사이트가 있어야 오너 멤버십을 이용할 수 있습니다.' }, { status: 400 });
  if (needsCreator && authorResult.data?.is_author !== true) return NextResponse.json({ error: '작가만 크리에이터 멤버십을 이용할 수 있습니다.' }, { status: 400 });

  const allPlanKeys = normalizedPurchases.flatMap((purchase) => purchase.featureKeys.map((key) => getMembershipPlanKey(purchase.type, key)));
  const planResult = await supabaseAdmin.from('plans').select('id, plan_key').in('plan_key', allPlanKeys);
  if (planResult.error || (planResult.data ?? []).length !== allPlanKeys.length) {
    return NextResponse.json({ error: '멤버십 상품 정보를 확인하지 못했습니다.' }, { status: 500 });
  }

  const planIdByKey = new Map((planResult.data ?? []).map((plan) => [plan.plan_key, plan.id]));
  const billingMethod = billingMethodResult.data as { customer_key: string; billing_key: string };
  const customerKey = billingMethod.customer_key || createCustomerKey(currentStigma.userId);
  const now = new Date();
  const billingAnchorDay = getBillingAnchorDay(now);
  const billingPeriod = createNextMonthlyBillingPeriod({ currentPeriodEnd: now, billingAnchorDay });
  const createdMembershipIds: string[] = [];
  const completedPaymentKeys: string[] = [];

  try {
    for (const purchase of normalizedPurchases) {
      const amount = getMembershipPrice(purchase.featureKeys as MembershipFeatureKey[], purchase.type);
      const orderNo = createOrderNo('MEMBERSHIP_PLATFORM');
      const orderName = `${purchase.type === 'all_in_one' ? '올인원' : purchase.type === 'creator' ? '크리에이터' : purchase.type === 'owner' ? '오너' : '아페토'} 멤버십`;
      const billingPayment = await requestMembershipBilling({ billingKey: billingMethod.billing_key, customerKey, amount, orderNo, orderName });
      completedPaymentKeys.push(billingPayment.paymentKey);
      const membershipResult = await supabaseAdmin
        .from('memberships')
        .insert({ user_id: currentStigma.stigmaId, membership_type: purchase.type })
        .select('id')
        .single();
      if (membershipResult.error) throw new Error('멤버십 정보를 저장하지 못했습니다.');
      createdMembershipIds.push(membershipResult.data.id);

      const membershipItemResult = await supabaseAdmin.from('membership_items').insert(
        purchase.featureKeys.map((key) => ({ membership_id: membershipResult.data.id, plan_id: planIdByKey.get(getMembershipPlanKey(purchase.type, key)) })),
      );
      if (membershipItemResult.error) throw new Error('선택한 기능을 저장하지 못했습니다.');

      const paymentResult = await supabaseAdmin
        .from('payments')
        .insert({
          provider: getCurrentPortOneProvider(),
          payment_key: billingPayment.paymentKey,
          transaction_no: getPortOnePaymentTransactionNo(billingPayment.payment),
          order_no: orderNo,
          buyer_user_id: currentStigma.stigmaId,
          amount,
          refunded_amount: 0,
          refunded_at: null,
          currency: 'KRW',
          status: PAYMENT_STATUS.PAID,
          payment_method: PAYMENT_METHOD.CARD,
          payment_type: PAYMENT_TYPE.MEMBERSHIP_PLATFORM,
          target_type: PAYMENT_TARGET_TYPE.MEMBERSHIP,
          target_id: membershipResult.data.id,
          subscription_id: null,
          refund_policy: REFUND_POLICY.MEMBERSHIP,
          raw_data: billingPayment.payment,
          approved_at: getPortOnePaidAt(billingPayment.payment),
          tx_no: null,
          post_payment: null,
          failure_code: null,
          failure_message: null,
          failure_stage: null,
          refundable_until: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single();
      if (paymentResult.error) throw new Error('결제 정보를 저장하지 못했습니다.');

      const subscriptionResult = await supabaseAdmin
        .from('subscriptions')
        .insert({
          subscriber_user_id: currentStigma.stigmaId,
          subscription_type: SUBSCRIPTION_TYPE.MEMBERSHIP_PLATFORM,
          target_type: PAYMENT_TARGET_TYPE.MEMBERSHIP,
          target_id: membershipResult.data.id,
          owner_user_id: currentStigma.stigmaId,
          price: amount,
          status: SUBSCRIPTION_STATUS.ACTIVE,
          billing_key: encrypt(billingMethod.billing_key),
          customer_key: customerKey,
          last_payment_id: paymentResult.data.id,
          trial_started_at: null,
          trial_ends_at: null,
          current_period_start: billingPeriod.currentPeriodStart,
          current_period_end: billingPeriod.currentPeriodEnd,
          next_billing_at: billingPeriod.nextBillingAt,
          billing_anchor_day: billingAnchorDay,
          canceled_at: null,
          expired_at: null,
        })
        .select('id')
        .single();
      if (subscriptionResult.error) throw new Error('월결제 정보를 저장하지 못했습니다.');

      const paymentUpdateResult = await supabaseAdmin.from('payments').update({ subscription_id: subscriptionResult.data.id }).eq('id', paymentResult.data.id);
      if (paymentUpdateResult.error) throw new Error('결제 구독 정보를 갱신하지 못했습니다.');
    }
  } catch (error) {
    await Promise.all(
      completedPaymentKeys.map((paymentKey) =>
        cancelPortOnePayment({ paymentId: paymentKey, cancelReason: '멤버십 결제 저장 실패' }).catch(() => null),
      ),
    );
    if (createdMembershipIds.length) await supabaseAdmin.from('memberships').delete().in('id', createdMembershipIds);
    return NextResponse.json({ error: error instanceof Error ? error.message : '멤버십 결제에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
