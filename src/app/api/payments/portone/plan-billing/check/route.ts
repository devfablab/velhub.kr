import { decrypt } from '@/lib/encryption/decrypt';
import { createNextMonthlyBillingPeriod } from '@/lib/payments/billingPeriod';
import { createPaymentOrderNo } from '@/lib/payments/orderNo';
import {
  getCurrentPortOneProvider,
  createPortOnePaymentKey,
  getPortOnePaidAmount,
  getPortOnePaidAt,
  PortOneApiError,
  requestPortOneBillingPayment,
  type PortOnePayment,
  type PortOnePaymentResponse,
  getPortOnePaymentTransactionNo,
  getPortOnePayment,
} from '@/lib/payments/portone';
import { getPaymentPolicyMs } from '@/lib/payments/refunds';
import {
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PAYMENT_TARGET_TYPE,
  PAYMENT_TYPE,
  REFUND_POLICY,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TYPE,
} from '@/lib/payments/types';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { getSiteOwnerAgeStatusFromBirthDate } from '@/lib/payments/siteOwnerAge';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type PlanBillingSubscriptionRow = {
  id: string;
  subscriber_user_id: string;
  target_id: string;
  price: number;
  billing_key: string;
  customer_key: string;
  last_payment_id: string | null;
  next_billing_at: string;
  billing_anchor_day: number;
  status: string;
  past_due_started_at: string | null;
};

type SiteOwnerRow = {
  id: string;
  owner_id: string;
  created_at: string;
};

type OwnerIdentityRow = {
  user_id: string;
  birth_date: string | null;
  birth_date_dummy: string | null;
  identity_verified_at: string | null;
};

const AUTOMATIC_FAILURE_STAGE = 'plan_billing_check';
const AUTOMATIC_RETRY_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_AUTOMATIC_PAYMENT_ATTEMPTS = 3;

function isValidCronRequest(request: Request) {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'test') {
    return true;
  }

  const authorization = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    throw new Error('자동결제 실행 키가 설정되지 않았습니다.');
  }

  return authorization === `Bearer ${cronSecret}`;
}

function createRefundableUntil(startedAt: Date) {
  return new Date(startedAt.getTime() + getPaymentPolicyMs()).toISOString();
}

function getPaymentFromResponse(paymentResponse: PortOnePaymentResponse) {
  if (paymentResponse.payment) {
    return paymentResponse.payment;
  }

  return paymentResponse as PortOnePayment;
}

function assertPaidPayment(payment: PortOnePayment) {
  if (normalizeText(payment.status).toUpperCase() !== 'PAID') {
    throw new Error('결제가 완료되지 않았습니다.');
  }
}

async function getLastPaymentRawStatus({
  supabaseAdmin,
  lastPaymentId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  lastPaymentId: string;
}) {
  const paymentResult = await supabaseAdmin.from('payments').select('raw_data').eq('id', lastPaymentId).maybeSingle();

  if (paymentResult.error) {
    throw new Error('이전 결제 정보를 확인하지 못했습니다.');
  }

  const rawData = paymentResult.data?.raw_data;

  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
    return '';
  }

  const status = (rawData as Record<string, unknown>).status;

  return typeof status === 'string' ? normalizeText(status).toUpperCase() : '';
}

async function getAutomaticFailureState({
  supabaseAdmin,
  subscription,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: PlanBillingSubscriptionRow;
}) {
  if (subscription.status !== SUBSCRIPTION_STATUS.PAST_DUE || !subscription.past_due_started_at) {
    return {
      failureCount: 0,
      lastFailedAt: null,
    };
  }

  const failedPaymentsResult = await supabaseAdmin
    .from('payments')
    .select('failure_stage, created_at')
    .eq('subscription_id', subscription.id)
    .eq('payment_type', PAYMENT_TYPE.PLAN_BILLING)
    .eq('status', PAYMENT_STATUS.FAILED)
    .gte('created_at', subscription.past_due_started_at)
    .order('created_at', { ascending: true });

  if (failedPaymentsResult.error) {
    throw new Error('자동결제 실패 횟수를 확인하지 못했습니다.');
  }

  const failedPayments = failedPaymentsResult.data ?? [];
  const automaticFailureCount = failedPayments.filter(
    (payment) => payment.failure_stage === AUTOMATIC_FAILURE_STAGE,
  ).length;
  const hasLegacyInitialFailure =
    failedPayments.length > 0 && failedPayments[0].failure_stage !== AUTOMATIC_FAILURE_STAGE;
  const lastFailedAt = failedPayments.at(-1)?.created_at ?? subscription.past_due_started_at;

  return {
    failureCount: automaticFailureCount + (hasLegacyInitialFailure ? 1 : 0),
    lastFailedAt,
  };
}

async function createFailedPayment({
  supabaseAdmin,
  subscription,
  orderNo,
  failureCode,
  failureMessage,
  rawData,
  previousFailureCount,
  now,
  nowIso,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: PlanBillingSubscriptionRow;
  orderNo: string;
  failureCode: string | null;
  failureMessage: string;
  rawData: unknown;
  previousFailureCount: number;
  now: Date;
  nowIso: string;
}) {
  const failureCount = previousFailureCount + 1;
  const shouldShutdown = failureCount >= MAX_AUTOMATIC_PAYMENT_ATTEMPTS;
  const nextRetryAt = new Date(now.getTime() + AUTOMATIC_RETRY_INTERVAL_MS).toISOString();
  const failedPaymentResult = await supabaseAdmin.from('payments').insert({
    provider: getCurrentPortOneProvider(),
    payment_key: null,
    order_no: orderNo,
    buyer_user_id: subscription.subscriber_user_id,
    amount: subscription.price,
    refunded_amount: 0,
    currency: 'KRW',
    status: PAYMENT_STATUS.FAILED,
    payment_method: PAYMENT_METHOD.CARD,
    payment_type: PAYMENT_TYPE.PLAN_BILLING,
    target_type: PAYMENT_TARGET_TYPE.PLAN,
    target_id: subscription.target_id,
    post_payment: null,
    subscription_id: subscription.id,
    failure_code: failureCode,
    failure_message: failureMessage,
    failure_stage: AUTOMATIC_FAILURE_STAGE,
    refund_policy: REFUND_POLICY.SEVEN_DAYS,
    refundable_until: null,
    approved_at: null,
    refunded_at: null,
    raw_data: rawData,
  });

  if (failedPaymentResult.error) {
    console.error(failedPaymentResult.error);
  }

  const subscriptionFailResult = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: SUBSCRIPTION_STATUS.PAST_DUE,
      past_due_started_at: subscription.past_due_started_at ?? nowIso,
      next_billing_at: shouldShutdown ? null : nextRetryAt,
      updated_at: nowIso,
    })
    .eq('id', subscription.id);

  if (subscriptionFailResult.error) {
    console.error(subscriptionFailResult.error);
  }

  const siteShutdownResult = await supabaseAdmin
    .from('rhizomes')
    .update({
      is_shutdown: shouldShutdown,
    })
    .eq('id', subscription.target_id);

  if (siteShutdownResult.error) {
    console.error(siteShutdownResult.error);
  }
}

async function chargePlanBillingSubscription({
  supabaseAdmin,
  subscription,
  now,
  nowIso,
}: {
  supabaseAdmin: SupabaseAdminClient;
  subscription: PlanBillingSubscriptionRow;
  now: Date;
  nowIso: string;
}) {
  const failureState = await getAutomaticFailureState({
    supabaseAdmin,
    subscription,
  });

  if (subscription.status === SUBSCRIPTION_STATUS.PAST_DUE && failureState.lastFailedAt) {
    const lastFailedAtTime = new Date(failureState.lastFailedAt).getTime();
    const canRetryAt = lastFailedAtTime + AUTOMATIC_RETRY_INTERVAL_MS;

    if (Number.isFinite(lastFailedAtTime) && canRetryAt > now.getTime()) {
      if (failureState.failureCount < MAX_AUTOMATIC_PAYMENT_ATTEMPTS) {
        const siteOpenResult = await supabaseAdmin
          .from('rhizomes')
          .update({
            is_shutdown: false,
          })
          .eq('id', subscription.target_id);

        if (siteOpenResult.error) {
          console.error(siteOpenResult.error);
        }
      }

      return {
        ok: null,
        subscriptionId: subscription.id,
      };
    }
  }

  const orderNo = createPaymentOrderNo('PLAN');
  const paymentKey = createPortOnePaymentKey(orderNo);
  let payment: PortOnePayment;

  try {
    const billingKey = decrypt(subscription.billing_key);

    await requestPortOneBillingPayment({
      paymentId: paymentKey,
      billingKey,
      customerId: subscription.customer_key,
      amount: subscription.price,
      orderName: '데브허브 사이트 요금제 결제',
    });

    const paymentResponse = await getPortOnePayment(paymentKey);

    payment = getPaymentFromResponse(paymentResponse);

    if (subscription.last_payment_id) {
      const lastPaymentRawStatus = await getLastPaymentRawStatus({
        supabaseAdmin,
        lastPaymentId: subscription.last_payment_id,
      });

      if (lastPaymentRawStatus !== 'PAID') {
        throw new Error('이전 결제 상태를 확인하지 못했습니다.');
      }
    }

    assertPaidPayment(payment);
  } catch (unknownError) {
    const failureCode = unknownError instanceof PortOneApiError ? unknownError.code : null;
    const failureMessage =
      unknownError instanceof Error ? unknownError.message || '자동결제에 실패했습니다.' : '자동결제에 실패했습니다.';
    const rawData = unknownError instanceof PortOneApiError ? unknownError.rawData : null;

    await createFailedPayment({
      supabaseAdmin,
      subscription,
      orderNo,
      failureCode,
      failureMessage,
      rawData,
      previousFailureCount: failureState.failureCount,
      now,
      nowIso,
    });

    return {
      ok: false,
      subscriptionId: subscription.id,
    };
  }

  const paymentInsertResult = await supabaseAdmin
    .from('payments')
    .insert({
      provider: getCurrentPortOneProvider(),
      payment_key: paymentKey,
      order_no: orderNo,
      tx_no: null,
      transaction_no: getPortOnePaymentTransactionNo(payment),
      buyer_user_id: subscription.subscriber_user_id,
      amount: getPortOnePaidAmount(payment) || subscription.price,
      refunded_amount: 0,
      currency: 'KRW',
      status: PAYMENT_STATUS.PAID,
      payment_method: PAYMENT_METHOD.CARD,
      payment_type: PAYMENT_TYPE.PLAN_BILLING,
      target_type: PAYMENT_TARGET_TYPE.PLAN,
      target_id: subscription.target_id,
      post_payment: null,
      subscription_id: subscription.id,
      failure_code: null,
      failure_message: null,
      failure_stage: null,
      refund_policy: REFUND_POLICY.SEVEN_DAYS,
      refundable_until: createRefundableUntil(now),
      approved_at: getPortOnePaidAt(payment),
      refunded_at: null,
      raw_data: payment,
    })
    .select('id')
    .single();

  if (paymentInsertResult.error) {
    console.error(paymentInsertResult.error);

    return {
      ok: false,
      subscriptionId: subscription.id,
    };
  }

  const nextBillingPeriod = createNextMonthlyBillingPeriod({
    currentPeriodEnd: subscription.next_billing_at,
    billingAnchorDay: subscription.billing_anchor_day,
  });

  const subscriptionUpdateResult = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: SUBSCRIPTION_STATUS.ACTIVE,
      current_period_start: nextBillingPeriod.currentPeriodStart,
      current_period_end: nextBillingPeriod.currentPeriodEnd,
      next_billing_at: nextBillingPeriod.nextBillingAt,
      past_due_started_at: null,
      last_payment_id: paymentInsertResult.data.id,
      updated_at: nowIso,
    })
    .eq('id', subscription.id);

  if (subscriptionUpdateResult.error) {
    console.error(subscriptionUpdateResult.error);

    return {
      ok: false,
      subscriptionId: subscription.id,
    };
  }

  const siteOpenResult = await supabaseAdmin
    .from('rhizomes')
    .update({
      is_shutdown: false,
    })
    .eq('id', subscription.target_id);

  if (siteOpenResult.error) {
    console.error(siteOpenResult.error);

    return {
      ok: false,
      subscriptionId: subscription.id,
    };
  }

  return {
    ok: true,
    subscriptionId: subscription.id,
  };
}

export async function GET(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    if (!isValidCronRequest(request)) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    const [sitesResult, planSubscriptionTargetsResult] = await Promise.all([
      supabaseAdmin.from('rhizomes').select('id, owner_id, created_at').not('plan_type', 'is', null),
      supabaseAdmin
        .from('subscriptions')
        .select('target_id')
        .eq('subscription_type', SUBSCRIPTION_TYPE.PLAN_BILLING)
        .eq('target_type', PAYMENT_TARGET_TYPE.PLAN),
    ]);

    if (sitesResult.error || planSubscriptionTargetsResult.error) {
      console.error(sitesResult.error ?? planSubscriptionTargetsResult.error);

      return Response.json({ error: '성년 전환 대상 사이트를 확인하지 못했습니다.' }, { status: 500 });
    }

    const sites = (sitesResult.data ?? []) as unknown as SiteOwnerRow[];
    const ownerStigmaIds = [...new Set(sites.map((site) => site.owner_id).filter(Boolean))];
    const identitiesResult = ownerStigmaIds.length
      ? await supabaseAdmin
          .from('chorogons')
          .select('user_id, birth_date, birth_date_dummy, identity_verified_at')
          .in('user_id', ownerStigmaIds)
      : { data: [], error: null };

    if (identitiesResult.error) {
      console.error(identitiesResult.error);

      return Response.json({ error: '성년 전환 대상 운영자 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const identityMap = new Map(
      ((identitiesResult.data ?? []) as unknown as OwnerIdentityRow[]).map((identity) => [identity.user_id, identity]),
    );
    const planSubscriptionTargetIds = new Set(
      (planSubscriptionTargetsResult.data ?? []).map((subscription) => subscription.target_id),
    );
    const sitesToShutdown = sites
      .filter((site) => {
        if (planSubscriptionTargetIds.has(site.id)) {
          return false;
        }

        const identity = identityMap.get(site.owner_id);

        if (!identity?.identity_verified_at || !identity.birth_date) {
          return false;
        }

        const birthDate =
          process.env.NEXT_PUBLIC_APP_ENV === 'test' && identity.birth_date_dummy
            ? identity.birth_date_dummy
            : decrypt(identity.birth_date);

        return getSiteOwnerAgeStatusFromBirthDate({
          birthDate,
          siteCreatedAt: site.created_at,
          now,
        }).isFormerMinorSite;
      })
      .map((site) => site.id);

    if (sitesToShutdown.length) {
      const shutdownResult = await supabaseAdmin.from('rhizomes').update({ is_shutdown: true }).in('id', sitesToShutdown);

      if (shutdownResult.error) {
        console.error(shutdownResult.error);

        return Response.json({ error: '결제수단 미등록 사이트를 중지하지 못했습니다.' }, { status: 500 });
      }
    }

    const subscriptionsResult = await supabaseAdmin
      .from('subscriptions')
      .select(
        [
          'id',
          'subscriber_user_id',
          'target_id',
          'price',
          'billing_key',
          'customer_key',
          'last_payment_id',
          'next_billing_at',
          'billing_anchor_day',
          'status',
          'past_due_started_at',
        ].join(', '),
      )
      .eq('subscription_type', SUBSCRIPTION_TYPE.PLAN_BILLING)
      .eq('target_type', PAYMENT_TARGET_TYPE.PLAN)
      .in('status', [SUBSCRIPTION_STATUS.TRIALING, SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PAST_DUE])
      .is('canceled_at', null)
      .is('expired_at', null)
      .not('next_billing_at', 'is', null)
      .lte('next_billing_at', nowIso)
      .order('next_billing_at', { ascending: true })
      .limit(20);

    if (subscriptionsResult.error) {
      console.error(subscriptionsResult.error);

      return Response.json({ error: '자동결제 대상을 불러오지 못했습니다.' }, { status: 500 });
    }

    const subscriptions = (subscriptionsResult.data ?? []) as unknown as PlanBillingSubscriptionRow[];

    const results = await Promise.all(
      subscriptions.map((subscription) =>
        chargePlanBillingSubscription({
          supabaseAdmin,
          subscription,
          now,
          nowIso,
        }),
      ),
    );

    const charged = results.filter((result) => result.ok).map((result) => result.subscriptionId);
    const failed = results.filter((result) => result.ok === false).map((result) => result.subscriptionId);
    const waiting = results.filter((result) => result.ok === null).map((result) => result.subscriptionId);

    return Response.json({
      ok: true,
      checkedCount: subscriptions.length,
      chargedCount: charged.length,
      failedCount: failed.length,
      waitingCount: waiting.length,
      charged,
      failed,
      waiting,
      shutdownWithoutBillingMethod: sitesToShutdown,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '자동결제를 처리하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '자동결제를 처리하지 못했습니다.' }, { status: 500 });
  }
}
