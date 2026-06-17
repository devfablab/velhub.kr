import { PAYMENT_TARGET_TYPE, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type ResumeMembershipBody = {
  siteName?: string;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
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
    const body = (await request.json()) as ResumeMembershipBody;
    const siteName = normalizeText(body.siteName).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const siteResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label')
      .eq('site_key', siteName)
      .maybeSingle();

    if (siteResult.error) {
      console.error(siteResult.error);

      return Response.json({ error: '사이트 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!siteResult.data) {
      return Response.json({ error: '사이트 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const site = siteResult.data as SiteRow;
    const session = await verifySession({ siteId: site.id });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const now = new Date();
    const nowText = now.toISOString();

    const subscriptionResult = await supabaseAdmin
      .from('subscriptions')
      .select('id, status, current_period_end, next_billing_at, canceled_at, expired_at')
      .eq('subscriber_user_id', session.authUserId)
      .eq('subscription_type', SUBSCRIPTION_TYPE.BLOG_MEMBERSHIP)
      .eq('target_type', PAYMENT_TARGET_TYPE.BLOG)
      .eq('target_id', site.id)
      .in('status', ['trialing', 'active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionResult.error) {
      console.error(subscriptionResult.error);

      return Response.json({ error: '멤버십 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!subscriptionResult.data) {
      return Response.json({ error: '취소 철회할 멤버십을 찾을 수 없습니다.' }, { status: 404 });
    }

    const subscription = subscriptionResult.data as SubscriptionRow;

    if (!subscription.canceled_at) {
      return Response.json({ error: '취소 예약된 멤버십이 아닙니다.' }, { status: 400 });
    }

    if (subscription.expired_at) {
      return Response.json({ error: '이미 종료된 멤버십입니다. 다시 결제해야 합니다.' }, { status: 400 });
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

      return Response.json({ error: '멤버십 취소를 철회하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      mode: 'resume_scheduled_cancel',
      nextBillingAt: subscription.current_period_end,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '멤버십 취소 철회에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '멤버십 취소 철회에 실패했습니다.' }, { status: 500 });
  }
}
