import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { encrypt } from '@/lib/encryption/encrypt';
import { isAtLeast14, isMinor } from '@/lib/identity/age';
import { getChorogonBirthDate } from '@/lib/identity/chorogon';
import { getMembershipPlanKey, getMembershipPrice, type MembershipFeatureKey } from '@/lib/memberships/catalog';
import { createNextMonthlyBillingPeriod, getBillingAnchorDay } from '@/lib/payments/billingPeriod';
import { createCustomerKey, getPaymentCustomer } from '@/lib/payments/customer';
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
import { calculateMembershipRefundAmount } from '@/lib/payments/refunds';
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

type MembershipFamily = 'creator' | 'affetto';

type ExistingMembershipSubscription = {
  id: string;
  status: string;
  price: number | null;
  last_payment_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  billing_anchor_day: number | null;
};

type ExistingMembershipPayment = {
  id: string;
  payment_key: string | null;
  amount: number;
  refunded_amount: number | null;
  status: string;
  approved_at: string | null;
  created_at: string;
};

type MembershipChange = {
  membership: { id: string; membership_type: string };
  subscription: ExistingMembershipSubscription | null;
  payment: ExistingMembershipPayment | null;
};

type ChangePlan = {
  periodStart: string;
  periodEnd: string;
  billingAnchorDay: number;
  totalDays: number;
  remainingDays: number;
  credit: number;
  refundablePayments: { id: string; paymentKey: string; amount: number }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function getMembershipFamily(type: string): MembershipFamily {
  return type === 'affetto' ? 'affetto' : 'creator';
}

function getRemainingDays(periodStart: Date, periodEnd: Date, now: Date) {
  const totalDays = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / DAY_MS));
  const usedDays = Math.min(totalDays, Math.max(0, Math.ceil((now.getTime() - periodStart.getTime()) / DAY_MS)));
  return { totalDays, remainingDays: totalDays - usedDays };
}

function getChangePlan(changes: MembershipChange[], now: Date): ChangePlan | null {
  if (!changes.length) return null;

  let credit = 0;
  const refundablePayments: ChangePlan['refundablePayments'] = [];
  let basePeriod: { start: Date; end: Date; anchorDay: number } | null = null;

  for (const { subscription, payment } of changes) {
    if (!subscription?.current_period_start || !subscription.current_period_end || !subscription.price) return null;
    if (
      subscription.status !== SUBSCRIPTION_STATUS.ACTIVE &&
      subscription.status !== SUBSCRIPTION_STATUS.TRIALING &&
      subscription.status !== SUBSCRIPTION_STATUS.CANCELED
    ) {
      return null;
    }
    if (payment && (payment.status !== PAYMENT_STATUS.PAID || Number(payment.refunded_amount ?? 0) !== 0)) return null;

    const start = new Date(subscription.current_period_start);
    const end = new Date(subscription.current_period_end);
    if (end.getTime() <= now.getTime()) return null;

    const { totalDays, remainingDays } = getRemainingDays(start, end, now);
    credit += Math.floor((Number(subscription.price) * remainingDays) / totalDays);
    if (payment?.payment_key && Number(payment.amount) > 0) {
      refundablePayments.push({ id: payment.id, paymentKey: payment.payment_key, amount: Number(payment.amount) });
    }

    if (!basePeriod || end.getTime() < basePeriod.end.getTime()) {
      basePeriod = { start, end, anchorDay: subscription.billing_anchor_day ?? getBillingAnchorDay(start) };
    }
  }

  if (!basePeriod) return null;

  const { totalDays, remainingDays } = getRemainingDays(basePeriod.start, basePeriod.end, now);

  return {
    periodStart: basePeriod.start.toISOString(),
    periodEnd: basePeriod.end.toISOString(),
    billingAnchorDay: basePeriod.anchorDay,
    totalDays,
    remainingDays,
    credit,
    refundablePayments,
  };
}

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
  customerName,
  customerEmail,
  customerPhoneNumber,
}: {
  billingKey: string;
  customerKey: string;
  amount: number;
  orderNo: string;
  orderName: string;
  customerName: string;
  customerEmail: string;
  customerPhoneNumber: string;
}) {
  const paymentKey = createPortOnePaymentKey(orderNo);
  await requestPortOneBillingPayment({
    paymentId: paymentKey,
    billingKey,
    customerId: customerKey,
    customerName,
    customerEmail,
    customerPhoneNumber,
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

  const body = (await request.json().catch(() => null)) as {
    purchases?: unknown;
    billingMethodId?: unknown;
    preview?: unknown;
  } | null;
  const purchases = Array.isArray(body?.purchases) ? body.purchases : [];
  const billingMethodId = typeof body?.billingMethodId === 'string' ? body.billingMethodId : '';
  const normalizedPurchases: MembershipPurchase[] = purchases.flatMap((purchase) => {
    if (!purchase || typeof purchase !== 'object') return [];
    const value = purchase as { type?: unknown; featureKeys?: unknown };
    const featureKeys = Array.isArray(value.featureKeys) ? value.featureKeys.filter(isFeatureKey) : [];
    return isMembershipType(value.type) ? [{ type: value.type, featureKeys }] : [];
  });

  const hasAllInOne = normalizedPurchases.some((purchase) => purchase.type === 'all_in_one');
  const validationErrors = [
    !billingMethodId ? '결제수단을 선택해 주세요.' : '',
    !normalizedPurchases.length || normalizedPurchases.some((purchase) => !isValidPurchase(purchase))
      ? '선택한 멤버십 구성을 확인해 주세요.'
      : '',
    hasAllInOne && normalizedPurchases.some((purchase) => purchase.type === 'owner' || purchase.type === 'creator')
      ? '올인원 멤버십은 오너 또는 크리에이터 멤버십과 함께 선택할 수 없습니다.'
      : '',
  ].filter(Boolean);
  if (validationErrors.length) {
    return NextResponse.json({ errors: validationErrors }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const identityResult = await supabaseAdmin
    .from('chorogons')
    .select('id, name, birth_date, birth_date_dummy, gender, identity_verified_at')
    .eq('user_id', currentStigma.stigmaId)
    .maybeSingle();

  if (identityResult.error) {
    return NextResponse.json({ error: '본인인증 정보를 확인하지 못했습니다.' }, { status: 500 });
  }

  if (
    !identityResult.data?.identity_verified_at ||
    !identityResult.data.name ||
    (!identityResult.data.birth_date && !identityResult.data.birth_date_dummy) ||
    !identityResult.data.gender
  ) {
    return NextResponse.json({ error: '멤버십 결제를 하려면 본인인증이 필요합니다.' }, { status: 403 });
  }

  const birthDate = getChorogonBirthDate(identityResult.data);
  if (!isAtLeast14(birthDate)) {
    return NextResponse.json({ error: '결제/구매는 데브허브 정책상 만 14세 이상부터 가능해요. 😭' }, { status: 403 });
  }
  if (isMinor(birthDate)) {
    return NextResponse.json({ error: '미성년 멤버십은 1개월 단건 결제로만 이용할 수 있습니다.' }, { status: 400 });
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

  const existingMemberships = existingMembershipResult.data ?? [];

  const hasCreatorFamily = normalizedPurchases.some((p) => ['owner', 'creator', 'all_in_one'].includes(p.type));
  const hasAffettoFamily = normalizedPurchases.some((p) => p.type === 'affetto');

  const membershipsToCancel = existingMemberships.filter((m) => {
    if (hasCreatorFamily && ['owner', 'creator', 'all_in_one'].includes(m.membership_type)) return true;
    if (hasAffettoFamily && m.membership_type === 'affetto') return true;
    return false;
  });

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
  const customer = await getPaymentCustomer(currentStigma.userId);
  if (!customer) return NextResponse.json({ error: '결제에 필요한 고객 정보를 확인하지 못했습니다.' }, { status: 400 });
  const now = new Date();
  const billingAnchorDay = getBillingAnchorDay(now);
  const billingPeriod = createNextMonthlyBillingPeriod({ currentPeriodEnd: now, billingAnchorDay });
  const createdMembershipIds: string[] = [];
  const completedPaymentKeys: string[] = [];

  const membershipChanges: MembershipChange[] = [];
  for (const membership of membershipsToCancel) {
    const subscriptionResult = await supabaseAdmin
      .from('subscriptions')
      .select('id,status,price,last_payment_id,current_period_start,current_period_end,billing_anchor_day')
      .eq('subscriber_user_id', currentStigma.stigmaId)
      .eq('subscription_type', SUBSCRIPTION_TYPE.MEMBERSHIP)
      .eq('target_type', PAYMENT_TARGET_TYPE.MEMBERSHIP)
      .eq('target_id', membership.id)
      .in('status', [
        SUBSCRIPTION_STATUS.TRIALING,
        SUBSCRIPTION_STATUS.ACTIVE,
        SUBSCRIPTION_STATUS.PAST_DUE,
        SUBSCRIPTION_STATUS.CANCELED,
      ])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subscriptionResult.error) {
      return NextResponse.json({ error: '멤버십 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const subscription = (subscriptionResult.data as ExistingMembershipSubscription | null) ?? null;
    let payment: ExistingMembershipPayment | null = null;
    if (subscription?.last_payment_id) {
      const paymentResult = await supabaseAdmin
        .from('payments')
        .select('id,payment_key,amount,refunded_amount,status,approved_at,created_at')
        .eq('id', subscription.last_payment_id)
        .maybeSingle();
      if (paymentResult.error) {
        return NextResponse.json({ error: '멤버십 결제 정보를 확인하지 못했습니다.' }, { status: 500 });
      }
      payment = (paymentResult.data as ExistingMembershipPayment | null) ?? null;
    }

    membershipChanges.push({ membership, subscription, payment });
  }

  const changePlans = new Map<MembershipFamily, ChangePlan>();
  for (const family of ['creator', 'affetto'] as const) {
    if (!normalizedPurchases.some((purchase) => getMembershipFamily(purchase.type) === family)) continue;
    const plan = getChangePlan(
      membershipChanges.filter((change) => getMembershipFamily(change.membership.membership_type) === family),
      now,
    );
    if (plan) changePlans.set(family, plan);
  }

  const remainingCredits = new Map<MembershipFamily, number>(
    [...changePlans].map(([family, plan]) => [family, plan.credit]),
  );
  const pricedPurchases = normalizedPurchases.map((purchase) => {
    const amount = getMembershipPrice(purchase.featureKeys as MembershipFeatureKey[], purchase.type);
    const family = getMembershipFamily(purchase.type);
    const changePlan = changePlans.get(family) ?? null;
    let chargeAmount = amount;
    if (changePlan) {
      const proratedAmount = Math.ceil((amount * changePlan.remainingDays) / changePlan.totalDays);
      const credit = Math.min(proratedAmount, remainingCredits.get(family) ?? 0);
      remainingCredits.set(family, (remainingCredits.get(family) ?? 0) - credit);
      chargeAmount = proratedAmount - credit;
    }
    const orderName = `${purchase.type === 'all_in_one' ? '올인원' : purchase.type === 'creator' ? '크리에이터' : purchase.type === 'owner' ? '오너' : '아페토'} 멤버십`;
    return { purchase, amount, chargeAmount, orderName, changePlan };
  });

  const changeRefunds = new Map<MembershipFamily, number>(
    [...changePlans].map(([family, plan]) => {
      const refundableTotal = plan.refundablePayments.reduce((total, payment) => total + payment.amount, 0);
      return [family, Math.min(remainingCredits.get(family) ?? 0, refundableTotal)];
    }),
  );

  if (body?.preview === true) {
    const fallbackRefundAmount = membershipChanges
      .filter((change) => !changePlans.has(getMembershipFamily(change.membership.membership_type)))
      .reduce((total, { payment }) => {
        if (!payment || payment.status !== PAYMENT_STATUS.PAID || Number(payment.refunded_amount ?? 0) !== 0) {
          return total;
        }
        return (
          total +
          calculateMembershipRefundAmount({
            amount: Number(payment.amount),
            paidAt: payment.approved_at ?? payment.created_at,
            now,
          }).refundAmount
        );
      }, 0);

    return NextResponse.json({
      chargeAmount: pricedPurchases.reduce((total, item) => total + item.chargeAmount, 0),
      refundAmount: [...changeRefunds.values()].reduce((total, amount) => total + amount, 0) + fallbackRefundAmount,
      items: pricedPurchases.map((item) => ({
        name: item.orderName,
        chargeAmount: item.chargeAmount,
        nextBillingAmount: item.amount,
        nextBillingAt: item.changePlan ? item.changePlan.periodEnd : billingPeriod.nextBillingAt,
      })),
    });
  }

  try {
    const preparedPurchases = [];
    for (const { purchase, amount, chargeAmount, orderName, changePlan } of pricedPurchases) {
      const orderNo = createOrderNo('MEMBERSHIP');
      const billingPayment =
        chargeAmount > 0
          ? await requestMembershipBilling({
              billingKey: billingMethod.billing_key,
              customerKey,
              amount: chargeAmount,
              orderNo,
              orderName,
              customerName: customer.name,
              customerEmail: customer.email,
              customerPhoneNumber: customer.phoneNumber,
            })
          : null;
      if (billingPayment) completedPaymentKeys.push(billingPayment.paymentKey);
      preparedPurchases.push({ purchase, amount, chargeAmount, orderNo, billingPayment, upgradePlan: changePlan });
    }

    for (const [family, plan] of changePlans) {
      let refundLeft = changeRefunds.get(family) ?? 0;
      for (const refundablePayment of plan.refundablePayments) {
        if (refundLeft <= 0) break;
        const refundAmount = Math.min(refundLeft, refundablePayment.amount);
        const cancelResult = await cancelPortOnePayment({
          paymentId: refundablePayment.paymentKey,
          cancelReason: '멤버십 변경에 따른 차액 환불',
          cancelAmount: refundAmount >= refundablePayment.amount ? undefined : refundAmount,
        });
        const paymentUpdateResult = await supabaseAdmin
          .from('payments')
          .update({
            status:
              refundAmount >= refundablePayment.amount ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIALLY_REFUNDED,
            refunded_amount: refundAmount,
            refunded_at: new Date().toISOString(),
            raw_data: cancelResult,
          })
          .eq('id', refundablePayment.id);
        if (paymentUpdateResult.error) throw new Error('멤버십 차액 환불 정보를 저장하지 못했습니다.');
        refundLeft -= refundAmount;
      }
    }

    for (const { membership, subscription, payment } of membershipChanges) {
      const isUpgrade = changePlans.has(getMembershipFamily(membership.membership_type));
      if (!isUpgrade && subscription?.last_payment_id) {
        if (
          payment &&
          payment.status === PAYMENT_STATUS.PAID &&
          Number(payment.refunded_amount ?? 0) === 0 &&
          payment.payment_key
        ) {
          const refund = calculateMembershipRefundAmount({
            amount: Number(payment.amount),
            paidAt: payment.approved_at ?? payment.created_at,
            now: new Date(),
          });

          if (refund.refundAmount > 0) {
            const cancelResult = await cancelPortOnePayment({
              paymentId: payment.payment_key,
              cancelReason: '멤버십 변경에 따른 환불',
              cancelAmount: refund.isFullRefund ? undefined : refund.refundAmount,
            });
            const status =
              refund.refundAmount >= Number(payment.amount)
                ? PAYMENT_STATUS.REFUNDED
                : PAYMENT_STATUS.PARTIALLY_REFUNDED;
            await supabaseAdmin
              .from('payments')
              .update({
                status,
                refunded_amount: refund.refundAmount,
                refunded_at: new Date().toISOString(),
                raw_data: cancelResult,
              })
              .eq('id', payment.id);
          }
        }
      }

      if (subscription) {
        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: SUBSCRIPTION_STATUS.CANCELED,
            canceled_at: new Date().toISOString(),
            expired_at: new Date().toISOString(),
            next_billing_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);
      }

      await supabaseAdmin.from('membership_items').delete().eq('membership_id', membership.id);
      await supabaseAdmin.from('memberships').delete().eq('id', membership.id);
    }
    for (const { purchase, amount, chargeAmount, orderNo, billingPayment, upgradePlan } of preparedPurchases) {
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

      let paymentId: string | null = null;
      if (billingPayment) {
        const paymentResult = await supabaseAdmin
          .from('payments')
          .insert({
            provider: getCurrentPortOneProvider(),
            payment_key: billingPayment.paymentKey,
            transaction_no: getPortOnePaymentTransactionNo(billingPayment.payment),
            order_no: orderNo,
            buyer_user_id: currentStigma.stigmaId,
            amount: chargeAmount,
            refunded_amount: 0,
            refunded_at: null,
            currency: 'KRW',
            status: PAYMENT_STATUS.PAID,
            payment_method: PAYMENT_METHOD.CARD,
            payment_type: PAYMENT_TYPE.MEMBERSHIP,
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
        paymentId = paymentResult.data.id;
      }

      const subscriptionResult = await supabaseAdmin
        .from('subscriptions')
        .insert({
          subscriber_user_id: currentStigma.stigmaId,
          subscription_type: SUBSCRIPTION_TYPE.MEMBERSHIP,
          target_type: PAYMENT_TARGET_TYPE.MEMBERSHIP,
          target_id: membershipResult.data.id,
          owner_user_id: currentStigma.stigmaId,
          price: amount,
          status: SUBSCRIPTION_STATUS.ACTIVE,
          billing_key: encrypt(billingMethod.billing_key),
          customer_key: customerKey,
          last_payment_id: paymentId,
          trial_started_at: null,
          trial_ends_at: null,
          current_period_start: upgradePlan ? upgradePlan.periodStart : billingPeriod.currentPeriodStart,
          current_period_end: upgradePlan ? upgradePlan.periodEnd : billingPeriod.currentPeriodEnd,
          next_billing_at: upgradePlan ? upgradePlan.periodEnd : billingPeriod.nextBillingAt,
          billing_anchor_day: upgradePlan ? upgradePlan.billingAnchorDay : billingAnchorDay,
          canceled_at: null,
          expired_at: null,
        })
        .select('id')
        .single();
      if (subscriptionResult.error) throw new Error('월결제 정보를 저장하지 못했습니다.');

      if (paymentId) {
        const paymentUpdateResult = await supabaseAdmin
          .from('payments')
          .update({ subscription_id: subscriptionResult.data.id })
          .eq('id', paymentId);
        if (paymentUpdateResult.error) throw new Error('결제 구독 정보를 갱신하지 못했습니다.');
      }
    }
  } catch {
    await Promise.all(
      completedPaymentKeys.map((paymentKey) =>
        cancelPortOnePayment({ paymentId: paymentKey, cancelReason: '멤버십 결제 저장 실패' }).catch(() => null),
      ),
    );
    if (createdMembershipIds.length) await supabaseAdmin.from('memberships').delete().in('id', createdMembershipIds);
    return NextResponse.json({ error: '멤버십 결제에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
