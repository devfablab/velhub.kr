import { NextResponse } from 'next/server';
import { encrypt } from '@/lib/encryption/encrypt';
import { isAtLeast14, isMinor } from '@/lib/identity/age';
import { getChorogonBirthDate } from '@/lib/identity/chorogon';
import { getMembershipPlanKey, getMembershipPrice, type MembershipFeatureKey } from '@/lib/memberships/catalog';
import { createNextMonthlyBillingPeriod, getBillingAnchorDay } from '@/lib/payments/billingPeriod';
import { createCustomerKey } from '@/lib/payments/customer';
import { createPaymentOrderNo as createOrderNo } from '@/lib/payments/orderNo';
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
import {
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PAYMENT_TARGET_TYPE,
  PAYMENT_TYPE,
  REFUND_POLICY,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TYPE,
} from '@/lib/payments/types';
import { getAuthorState } from '@/lib/session/author';
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
  return (
    featureKeys.every((key) => ['owner', 'creator'].includes(getFeatureGroup(key))) &&
    ownerCount >= 2 &&
    creatorCount >= 2
  );
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

  if (
    !billingMethodId ||
    !normalizedPurchases.length ||
    normalizedPurchases.some((purchase) => !isValidPurchase(purchase))
  ) {
    return NextResponse.json({ error: '선택한 멤버십 구성이 올바르지 않습니다.' }, { status: 400 });
  }

  const hasAllInOne = normalizedPurchases.some((purchase) => purchase.type === 'all_in_one');
  if (hasAllInOne && normalizedPurchases.some((purchase) => purchase.type === 'owner' || purchase.type === 'creator')) {
    return NextResponse.json(
      { error: '올인원 멤버십은 다른 창작자 멤버십과 함께 선택할 수 없습니다.' },
      { status: 400 },
    );
  }

  const supabaseAdmin = getSupabaseAdmin();
  const identityResult = await supabaseAdmin
    .from('chorogons')
    .select('id, birth_date, birth_date_dummy')
    .eq('user_id', currentStigma.stigmaId)
    .maybeSingle();

  if (identityResult.error) {
    return NextResponse.json({ error: '본인인증 정보를 확인하지 못했습니다.' }, { status: 500 });
  }

  const birthDate = getChorogonBirthDate(identityResult.data);
  if (!isAtLeast14(birthDate)) {
    return NextResponse.json({ error: '결제/구매는 데브허브 정책상 만 14세 이상부터 가능해요. 😭' }, { status: 403 });
  }
  const isMinorUser = isMinor(birthDate);

  if (isMinorUser) {
    const expiredSubscriptionResult = await supabaseAdmin
      .from('subscriptions')
      .select('target_id')
      .eq('subscriber_user_id', currentStigma.stigmaId)
      .eq('subscription_type', SUBSCRIPTION_TYPE.MEMBERSHIP_PLATFORM)
      .eq('target_type', PAYMENT_TARGET_TYPE.MEMBERSHIP)
      .eq('status', SUBSCRIPTION_STATUS.CANCELED)
      .lt('current_period_end', new Date().toISOString());

    if (expiredSubscriptionResult.error) {
      return NextResponse.json({ error: '기존 멤버십 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const expiredMembershipIds = (expiredSubscriptionResult.data ?? [])
      .map((subscription) => subscription.target_id)
      .filter((membershipId): membershipId is string => Boolean(membershipId));

    if (expiredMembershipIds.length) {
      const itemDeleteResult = await supabaseAdmin.from('membership_items').delete().in('membership_id', expiredMembershipIds);
      const membershipDeleteResult = itemDeleteResult.error
        ? { error: itemDeleteResult.error }
        : await supabaseAdmin.from('memberships').delete().in('id', expiredMembershipIds);

      if (itemDeleteResult.error || membershipDeleteResult.error) {
        return NextResponse.json({ error: '만료된 멤버십 정보를 정리하지 못했습니다.' }, { status: 500 });
      }
    }
  }

  const [billingMethodResult, existingMembershipResult, ownedSiteResult, authorResult] = await Promise.all([
    supabaseAdmin
      .from('subscription_billing_methods')
      .select('id, customer_key, billing_key')
      .eq('id', billingMethodId)
      .eq('user_id', currentStigma.stigmaId)
      .eq('provider', getCurrentPortOneProvider())
      .maybeSingle(),
    supabaseAdmin.from('memberships').select('id, membership_type').eq('user_id', currentStigma.stigmaId),
    supabaseAdmin
      .from('rhizomes')
      .select('id')
      .eq('owner_id', currentStigma.stigmaId)
      .eq('is_shutdown', false)
      .limit(1),
    getAuthorState(currentStigma.stigmaId),
  ]);

  if (billingMethodResult.error || !billingMethodResult.data)
    return NextResponse.json({ error: '선택한 결제수단을 확인하지 못했습니다.' }, { status: 400 });
  if (existingMembershipResult.error || ownedSiteResult.error)
    return NextResponse.json({ error: '멤버십 정보를 확인하지 못했습니다.' }, { status: 500 });

  const existingTypes = new Set((existingMembershipResult.data ?? []).map((membership) => membership.membership_type));
  if (normalizedPurchases.some((purchase) => existingTypes.has(purchase.type))) {
    return NextResponse.json({ error: '이미 이용 중인 멤버십이 포함되어 있습니다.' }, { status: 400 });
  }

  const isUsingAllInOne = existingTypes.has('all_in_one');
  const isUsingIndividualCreatorMembership = existingTypes.has('owner') || existingTypes.has('creator');
  if ((hasAllInOne && isUsingIndividualCreatorMembership) || (!hasAllInOne && isUsingAllInOne)) {
    return NextResponse.json(
      { error: '올인원 멤버십과 오너·크리에이터 멤버십은 함께 이용할 수 없습니다.' },
      { status: 400 },
    );
  }

  const needsOwner = normalizedPurchases.some(
    (purchase) => purchase.type === 'owner' || purchase.type === 'all_in_one',
  );
  const needsCreator = normalizedPurchases.some(
    (purchase) => purchase.type === 'creator' || purchase.type === 'all_in_one',
  );
  if (needsOwner && !(ownedSiteResult.data ?? []).length)
    return NextResponse.json({ error: '운영 중인 사이트가 있어야 오너 멤버십을 이용할 수 있습니다.' }, { status: 400 });
  if (needsCreator && !authorResult.isAuthor)
    return NextResponse.json({ error: '작가만 크리에이터 멤버십을 이용할 수 있습니다.' }, { status: 400 });

  const allPlanKeys = normalizedPurchases.flatMap((purchase) =>
    purchase.featureKeys.map((key) => getMembershipPlanKey(purchase.type, key)),
  );
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
      const membershipLabel = purchase.type === 'all_in_one' ? '올인원' : purchase.type === 'creator' ? '크리에이터' : purchase.type === 'owner' ? '오너' : '아페토';
      const orderName = isMinorUser ? `${membershipLabel} 1개월 멤버십 구독` : `${membershipLabel} 멤버십`;
      const billingPayment = await requestMembershipBilling({
        billingKey: billingMethod.billing_key,
        customerKey,
        amount,
        orderNo,
        orderName,
      });
      completedPaymentKeys.push(billingPayment.paymentKey);
      const membershipResult = await supabaseAdmin
        .from('memberships')
        .insert({ user_id: currentStigma.stigmaId, membership_type: purchase.type })
        .select('id')
        .single();
      if (membershipResult.error) throw new Error('멤버십 정보를 저장하지 못했습니다.');
      createdMembershipIds.push(membershipResult.data.id);

      const membershipItemResult = await supabaseAdmin.from('membership_items').insert(
        purchase.featureKeys.map((key) => ({
          membership_id: membershipResult.data.id,
          plan_id: planIdByKey.get(getMembershipPlanKey(purchase.type, key)),
        })),
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
        status: isMinorUser ? SUBSCRIPTION_STATUS.CANCELED : SUBSCRIPTION_STATUS.ACTIVE,
          billing_key: encrypt(billingMethod.billing_key),
          customer_key: customerKey,
          last_payment_id: paymentResult.data.id,
          trial_started_at: null,
          trial_ends_at: null,
          current_period_start: billingPeriod.currentPeriodStart,
          current_period_end: billingPeriod.currentPeriodEnd,
        next_billing_at: isMinorUser ? null : billingPeriod.nextBillingAt,
          billing_anchor_day: billingAnchorDay,
        canceled_at: isMinorUser ? now.toISOString() : null,
          expired_at: null,
        })
        .select('id')
        .single();
      if (subscriptionResult.error) throw new Error('월결제 정보를 저장하지 못했습니다.');

      const paymentUpdateResult = await supabaseAdmin
        .from('payments')
        .update({ subscription_id: subscriptionResult.data.id })
        .eq('id', paymentResult.data.id);
      if (paymentUpdateResult.error) throw new Error('결제 구독 정보를 갱신하지 못했습니다.');
    }
  } catch (error) {
    await Promise.all(
      completedPaymentKeys.map((paymentKey) =>
        cancelPortOnePayment({ paymentId: paymentKey, cancelReason: '멤버십 결제 저장 실패' }).catch(() => null),
      ),
    );
    if (createdMembershipIds.length) await supabaseAdmin.from('memberships').delete().in('id', createdMembershipIds);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '멤버십 결제에 실패했습니다.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
