import { PAYMENT_TARGET_TYPE, SUBSCRIPTION_STATUS, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SiteRow = {
  id: string;
  site_key: string;
  site_type: string;
  is_shutdown: boolean;
};

type SubscriptionSettingRow = {
  id: string;
  is_enabled: boolean;
  price: number;
};

type SubscriptionRow = {
  id: string;
  status: string;
};

function isValidMembershipPrice(price: number) {
  if (!Number.isInteger(price)) {
    return false;
  }

  if (price < 1000) {
    return false;
  }

  if (price > 100000) {
    return false;
  }

  return price % 1000 === 0;
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
      .select('id, site_key, site_type, is_shutdown')
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

    if (site.site_type !== 'blog' || site.is_shutdown) {
      return Response.json({
        isEnabled: false,
        price: null,
        membershipStatus: 'none',
      });
    }

    const settingResult = await supabaseAdmin
      .from('subscription_settings')
      .select('id, is_enabled, price')
      .eq('target_type', PAYMENT_TARGET_TYPE.BLOG)
      .eq('target_id', site.id)
      .eq('subscription_type', SUBSCRIPTION_TYPE.BLOG_MEMBERSHIP)
      .maybeSingle();

    if (settingResult.error) {
      console.error(settingResult.error);

      return Response.json({ error: '멤버십 설정을 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!settingResult.data) {
      return Response.json({
        isEnabled: false,
        price: null,
        membershipStatus: 'none',
      });
    }

    const setting = settingResult.data as SubscriptionSettingRow;

    if (!setting.is_enabled) {
      return Response.json({
        isEnabled: false,
        price: null,
        membershipStatus: 'none',
      });
    }

    if (!isValidMembershipPrice(setting.price)) {
      return Response.json({ error: '멤버십 금액 설정이 올바르지 않습니다.' }, { status: 400 });
    }

    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({
        isEnabled: true,
        price: setting.price,
        membershipStatus: 'none',
      });
    }

    const subscriptionResult = await supabaseAdmin
      .from('subscriptions')
      .select('id, status')
      .eq('subscriber_user_id', session.authUserId)
      .eq('subscription_type', PAYMENT_TARGET_TYPE.BLOG)
      .eq('target_type', PAYMENT_TARGET_TYPE.BLOG)
      .eq('target_id', site.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionResult.error) {
      console.error(subscriptionResult.error);

      return Response.json({ error: '멤버십 가입 상태를 확인하지 못했습니다.' }, { status: 500 });
    }

    const subscription = subscriptionResult.data as SubscriptionRow | null;

    return Response.json({
      isEnabled: true,
      price: setting.price,
      membershipStatus: subscription?.status === SUBSCRIPTION_STATUS.ACTIVE ? 'active' : 'none',
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '멤버십 상태를 확인하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '멤버십 상태를 확인하지 못했습니다.' }, { status: 500 });
  }
}
