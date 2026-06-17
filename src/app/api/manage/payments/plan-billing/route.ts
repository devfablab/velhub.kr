import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { PAYMENT_TARGET_TYPE, PAYMENT_TYPE, SUBSCRIPTION_TYPE } from '@/lib/payments/types';

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

    if (siteResult.error || !siteResult.data) {
      return Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 404 });
    }

    const site = siteResult.data as SiteRow;
    const session = await verifySession({ siteId: site.id });

    if (session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    let plan: {
      id: string;
      name: string | null;
      price: number;
    } | null = null;

    if (site.plan_type) {
      const planResult = await supabaseAdmin
        .from('plans')
        .select('id, plan_label, price')
        .eq('id', site.plan_type)
        .maybeSingle();

      if (planResult.error) {
        return Response.json({ error: '요금제 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      const planData = planResult.data as PlanRow | null;

      if (planData) {
        plan = {
          id: planData.id,
          name: planData.plan_label,
          price: planData.price,
        };
      }
    }

    const subscriptionResult = await supabaseAdmin
      .from('subscriptions')
      .select(
        [
          'id',
          'subscription_type',
          'target_type',
          'target_id',
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
      return Response.json({ error: '구독 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

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
      return Response.json({ error: paymentsResult.error.message }, { status: 500 });
    }

    return Response.json({
      site: {
        id: site.id,
        siteKey: site.site_key,
        siteLabel: site.site_label,
      },
      plan,
      subscription: subscriptionResult.data ?? null,
      payments: paymentsResult.data ?? [],
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '결제 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '결제 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
