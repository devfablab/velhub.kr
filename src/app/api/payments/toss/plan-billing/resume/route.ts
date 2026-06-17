import { PAYMENT_TARGET_TYPE, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type ResumePlanBillingBody = {
  siteId?: string;
};

type SubscriptionRow = {
  id: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
  current_period_end: string;
  next_billing_at: string | null;
  canceled_at: string | null;
  expired_at: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ResumePlanBillingBody;
    const siteId = normalizeText(body.siteId);

    if (!siteId) {
      return Response.json({ error: 'siteId가 유효하지 않습니다.' }, { status: 400 });
    }

    const session = await verifySession({ siteId });

    if (session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const now = new Date();
    const nowText = now.toISOString();

    const subscriptionResult = await supabaseAdmin
      .from('subscriptions')
      .select('id, status, current_period_end, next_billing_at, canceled_at, expired_at')
      .eq('subscription_type', SUBSCRIPTION_TYPE.PLAN_BILLING)
      .eq('target_type', PAYMENT_TARGET_TYPE.PLAN)
      .eq('target_id', siteId)
      .in('status', ['trialing', 'active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionResult.error) {
      console.error(subscriptionResult.error);

      return Response.json({ error: '요금제 구독 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!subscriptionResult.data) {
      return Response.json({ error: '취소 철회할 요금제 구독을 찾을 수 없습니다.' }, { status: 404 });
    }

    const subscription = subscriptionResult.data as SubscriptionRow;

    if (!subscription.canceled_at) {
      return Response.json({ error: '취소 예약된 요금제 구독이 아닙니다.' }, { status: 400 });
    }

    if (subscription.expired_at) {
      return Response.json({ error: '이미 종료된 요금제 구독입니다. 다시 결제해야 합니다.' }, { status: 400 });
    }

    if (new Date(subscription.current_period_end).getTime() <= now.getTime()) {
      return Response.json({ error: '이미 현재 이용 기간이 종료되었습니다. 다시 결제해야 합니다.' }, { status: 400 });
    }

    const subscriptionUpdateResult = await supabaseAdmin
      .from('subscriptions')
      .update({
        canceled_at: null,
        next_billing_at: subscription.current_period_end,
        updated_at: nowText,
      })
      .eq('id', subscription.id);

    if (subscriptionUpdateResult.error) {
      console.error(subscriptionUpdateResult.error);

      return Response.json({ error: '요금제 구독 취소를 철회하지 못했습니다.' }, { status: 500 });
    }

    const siteOpenResult = await supabaseAdmin.from('rhizomes').update({ is_shutdown: false }).eq('id', siteId);

    if (siteOpenResult.error) {
      console.error(siteOpenResult.error);

      return Response.json({ error: '사이트 상태를 갱신하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      mode: 'resume_scheduled_cancel',
      nextBillingAt: subscription.current_period_end,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '요금제 구독 취소 철회에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '요금제 구독 취소 철회에 실패했습니다.' }, { status: 500 });
  }
}
