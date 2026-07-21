import { PAYMENT_PROVIDER, PAYMENT_TARGET_TYPE, PAYMENT_TYPE, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import { decrypt } from '@/lib/encryption/decrypt';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string;
  plan_type: string;
};

type PlanRow = {
  id: string;
  plan_label: string;
  price: number;
};

type BillingMethodRow = {
  id: string;
  provider: string;
  card_company: string;
  card_number_masked: string;
  owner_type: string;
  card_type: string;
  is_default: boolean;
  created_at: string;
  updated_at: string | null;
};

type SubscriptionRow = {
  id: string;
  subscription_type: string;
  target_type: string;
  target_id: string;
  subscriber_user_id: string | null;
  billing_key: string | null;
  previous_billing_method_id: string | null;
  price: number;
  status: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  next_billing_at: string | null;
  past_due_started_at: string | null;
  canceled_at: string | null;
  expired_at: string | null;
  created_at: string;
  updated_at: string;
};

function isSameCard(first: BillingMethodRow, second: BillingMethodRow) {
  return (
    first.provider === second.provider &&
    first.card_company === second.card_company &&
    first.card_number_masked === second.card_number_masked &&
    first.owner_type === second.owner_type &&
    first.card_type === second.card_type
  );
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const siteResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label, plan_type')
      .eq('site_key', siteName)
      .maybeSingle();

    if (siteResult.error) {
      console.error(siteResult.error);

      return Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!siteResult.data) {
      return Response.json({ error: '사이트 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const site = siteResult.data as SiteRow;

    const session = await verifySession({
      siteId: site.id,
    });

    if (session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const planResult = site.plan_type
      ? await supabaseAdmin.from('plans').select('id, plan_label, price').eq('id', site.plan_type).maybeSingle()
      : { data: null, error: null };

    if (planResult.error) {
      console.error(planResult.error);

      return Response.json({ error: '요금제 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const planData = planResult.data as PlanRow | null;
    const plan = planData
      ? {
          id: planData.id,
          name: planData.plan_label,
          price: planData.price,
        }
      : null;

    const subscriptionResult = await supabaseAdmin
      .from('subscriptions')
      .select(
        [
          'id',
          'subscription_type',
          'target_type',
          'target_id',
          'subscriber_user_id',
          'billing_key',
          'previous_billing_method_id',
          'price',
          'status',
          'trial_started_at',
          'trial_ends_at',
          'current_period_start',
          'current_period_end',
          'next_billing_at',
          'past_due_started_at',
          'canceled_at',
          'expired_at',
          'created_at',
          'updated_at',
        ].join(', '),
      )
      .eq('subscription_type', SUBSCRIPTION_TYPE.PLAN_BILLING)
      .eq('target_type', PAYMENT_TARGET_TYPE.PLAN)
      .eq('target_id', site.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionResult.error) {
      console.error(subscriptionResult.error);

      return Response.json({ error: '구독 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const subscription = (subscriptionResult.data as unknown as SubscriptionRow | null) ?? null;

    const paymentsResult = await supabaseAdmin
      .from('payments')
      .select(
        [
          'id',
          'provider',
          'payment_key',
          'order_no',
          'amount',
          'currency',
          'status',
          'payment_method',
          'payment_type',
          'target_type',
          'target_id',
          'subscription_id',
          'failure_code',
          'failure_message',
          'failure_stage',
          'refund_policy',
          'refundable_until',
          'approved_at',
          'refunded_at',
          'created_at',
        ].join(', '),
      )
      .eq('payment_type', PAYMENT_TYPE.PLAN_BILLING)
      .eq('target_type', PAYMENT_TARGET_TYPE.PLAN)
      .eq('target_id', site.id)
      .order('created_at', { ascending: false });

    if (paymentsResult.error) {
      console.error(paymentsResult.error);

      return Response.json({ error: '결제 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const currentBillingMethodResult =
      subscription?.subscriber_user_id && subscription.billing_key
        ? await supabaseAdmin
            .from('subscription_billing_methods')
            .select(
              [
                'id',
                'provider',
                'card_company',
                'card_number_masked',
                'owner_type',
                'card_type',
                'is_default',
                'created_at',
                'updated_at',
              ].join(', '),
            )
            .eq('user_id', subscription.subscriber_user_id)
            .eq('billing_key', decrypt(subscription.billing_key))
            .eq('provider', PAYMENT_PROVIDER.KPN)
            .limit(1)
        : { data: [], error: null };

    const previousBillingMethodResult = subscription?.previous_billing_method_id
      ? await supabaseAdmin
          .from('subscription_billing_methods')
          .select(
            [
              'id',
              'provider',
              'card_company',
              'card_number_masked',
              'owner_type',
              'card_type',
              'is_default',
              'created_at',
              'updated_at',
            ].join(', '),
          )
          .eq('id', subscription.previous_billing_method_id)
          .limit(1)
      : { data: [], error: null };

    if (currentBillingMethodResult.error || previousBillingMethodResult.error) {
      console.error(currentBillingMethodResult.error ?? previousBillingMethodResult.error);

      return Response.json({ error: '결제수단 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const currentBillingMethod =
      ((currentBillingMethodResult.data ?? [])[0] as unknown as BillingMethodRow | undefined) ?? null;
    const previousBillingMethod =
      ((previousBillingMethodResult.data ?? [])[0] as unknown as BillingMethodRow | undefined) ?? null;
    const billingMethods = currentBillingMethod
      ? [
          {
            ...currentBillingMethod,
            is_default: true,
          },
          ...(previousBillingMethod && !isSameCard(currentBillingMethod, previousBillingMethod)
            ? [
                {
                  ...previousBillingMethod,
                  is_default: false,
                },
              ]
            : []),
        ]
      : previousBillingMethod
        ? [
            {
              ...previousBillingMethod,
              is_default: false,
            },
          ]
        : [];

    return Response.json({
      site: {
        id: site.id,
        siteKey: site.site_key,
        siteLabel: site.site_label,
      },
      plan,
      subscription: subscription
        ? {
            id: subscription.id,
            subscription_type: subscription.subscription_type,
            target_type: subscription.target_type,
            target_id: subscription.target_id,
            price: subscription.price,
            status: subscription.status,
            trial_started_at: subscription.trial_started_at,
            trial_ends_at: subscription.trial_ends_at,
            current_period_start: subscription.current_period_start,
            current_period_end: subscription.current_period_end,
            next_billing_at: subscription.next_billing_at,
            past_due_started_at: subscription.past_due_started_at,
            canceled_at: subscription.canceled_at,
            expired_at: subscription.expired_at,
            created_at: subscription.created_at,
            updated_at: subscription.updated_at,
          }
        : null,
      payments: paymentsResult.data ?? [],
      billingMethods,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '결제 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '결제 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
