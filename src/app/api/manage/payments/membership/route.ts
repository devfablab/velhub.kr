import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import {
  PAYMENT_STATUS,
  PAYMENT_TARGET_TYPE,
  PAYMENT_TYPE,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TYPE,
} from '@/lib/payments/types';

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  site_type: string;
};

type SubscriptionSettingRow = {
  id: string;
  target_type: string;
  target_id: string;
  subscription_type: string;
  is_enabled: boolean;
  price: number;
  created_at: string;
};

type MembershipSubscriptionRow = {
  id: string;
  subscriber_user_id: string;
  status: string;
  created_at: string;
  updated_at: string | null;
};

type MembershipPaymentRow = {
  id: string;
  buyer_user_id: string;
  approved_at: string | null;
  created_at: string;
};

type StigmaRow = {
  id: string;
  user_id: string;
};

type RhizomeStigmaRow = {
  user_id: string;
  nickname: string;
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

function getMembershipStatus(status: string) {
  if (status === SUBSCRIPTION_STATUS.ACTIVE) {
    return '유지 중';
  }

  return '중단';
}

function getNickname({
  subscriberUserId,
  stigmaIdByParticleId,
  nicknameByStigmaId,
}: {
  subscriberUserId: string;
  stigmaIdByParticleId: Map<string, string>;
  nicknameByStigmaId: Map<string, string>;
}) {
  const stigmaId = stigmaIdByParticleId.get(subscriberUserId);

  if (!stigmaId) {
    return '매칭 실패';
  }

  return nicknameByStigmaId.get(stigmaId) ?? '매칭 실패';
}

async function getSiteAndSession(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_label, site_type')
    .eq('site_key', siteName)
    .maybeSingle();

  if (siteResult.error) {
    console.error(siteResult.error);

    return {
      response: Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 500 }),
      site: null,
      supabaseAdmin,
    };
  }

  if (!siteResult.data) {
    return {
      response: Response.json({ error: '사이트 정보를 찾을 수 없습니다.' }, { status: 404 }),
      site: null,
      supabaseAdmin,
    };
  }

  const site = siteResult.data as SiteRow;
  const session = await verifySession({ siteId: site.id });

  if (session.case !== 'staff') {
    return {
      response: Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 }),
      site: null,
      supabaseAdmin,
    };
  }

  if (site.site_type !== 'blog') {
    return {
      response: Response.json({ error: '블로그 멤버십은 블로그에서만 사용할 수 있습니다.' }, { status: 400 }),
      site: null,
      supabaseAdmin,
    };
  }

  return {
    response: null,
    site,
    supabaseAdmin,
  };
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const siteAndSession = await getSiteAndSession(siteName);

    if (siteAndSession.response || !siteAndSession.site) {
      return siteAndSession.response;
    }

    const { site, supabaseAdmin } = siteAndSession;

    const settingResult = await supabaseAdmin
      .from('subscription_settings')
      .select('id, target_type, target_id, subscription_type, is_enabled, price, created_at')
      .eq('target_type', PAYMENT_TARGET_TYPE.BLOG)
      .eq('target_id', site.id)
      .eq('subscription_type', SUBSCRIPTION_TYPE.BLOG_MEMBERSHIP)
      .maybeSingle();

    if (settingResult.error) {
      console.error(settingResult.error);

      return Response.json({ error: '멤버십 설정을 불러오지 못했습니다.' }, { status: 500 });
    }

    const setting = settingResult.data as SubscriptionSettingRow | null;

    const subscriptionsResult = await supabaseAdmin
      .from('subscriptions')
      .select('id, subscriber_user_id, status, created_at')
      .eq('subscription_type', PAYMENT_TARGET_TYPE.BLOG)
      .eq('target_type', PAYMENT_TARGET_TYPE.BLOG)
      .eq('target_id', site.id)
      .order('created_at', { ascending: false });

    if (subscriptionsResult.error) {
      console.error(subscriptionsResult.error);

      return Response.json({ error: '멤버십 구독자 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const subscriptions = (subscriptionsResult.data ?? []) as MembershipSubscriptionRow[];
    const subscriberUserIds = Array.from(new Set(subscriptions.map((subscription) => subscription.subscriber_user_id)));

    const paymentsResult = await supabaseAdmin
      .from('payments')
      .select('id, buyer_user_id, approved_at, created_at')
      .eq('payment_type', PAYMENT_TYPE.BLOG_MEMBERSHIP)
      .eq('target_type', PAYMENT_TARGET_TYPE.BLOG)
      .eq('target_id', site.id)
      .eq('status', PAYMENT_STATUS.PAID);

    if (paymentsResult.error) {
      console.error(paymentsResult.error);

      return Response.json({ error: '멤버십 결제 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const payments = (paymentsResult.data ?? []) as MembershipPaymentRow[];
    const paymentStatsByUserId = new Map<string, { activeMonths: number; lastPaidAt: string | null }>();

    for (const payment of payments) {
      const currentStats = paymentStatsByUserId.get(payment.buyer_user_id);
      const paidAt = payment.approved_at ?? payment.created_at;

      if (!currentStats) {
        paymentStatsByUserId.set(payment.buyer_user_id, {
          activeMonths: 1,
          lastPaidAt: paidAt,
        });
        continue;
      }

      paymentStatsByUserId.set(payment.buyer_user_id, {
        activeMonths: currentStats.activeMonths + 1,
        lastPaidAt: !currentStats.lastPaidAt || paidAt > currentStats.lastPaidAt ? paidAt : currentStats.lastPaidAt,
      });
    }

    const stigmasResult = subscriberUserIds.length
      ? await supabaseAdmin.from('stigmas').select('id, user_id').in('user_id', subscriberUserIds)
      : { data: [], error: null };

    if (stigmasResult.error) {
      console.error(stigmasResult.error);

      return Response.json({ error: '멤버십 구독자 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const stigmas = (stigmasResult.data ?? []) as StigmaRow[];
    const stigmaIdByParticleId = new Map(stigmas.map((stigma) => [stigma.user_id, stigma.id]));
    const subscriberStigmaIds = stigmas.map((stigma) => stigma.id);

    const rhizomeStigmasResult = subscriberStigmaIds.length
      ? await supabaseAdmin
          .from('rhizome_stigmas')
          .select('user_id, nickname')
          .eq('site_id', site.id)
          .in('user_id', subscriberStigmaIds)
      : { data: [], error: null };

    if (rhizomeStigmasResult.error) {
      console.error(rhizomeStigmasResult.error);

      return Response.json({ error: '멤버십 구독자 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const rhizomeStigmas = (rhizomeStigmasResult.data ?? []) as RhizomeStigmaRow[];
    const nicknameByStigmaId = new Map(
      rhizomeStigmas.map((rhizomeStigma) => [rhizomeStigma.user_id, rhizomeStigma.nickname]),
    );

    return Response.json({
      site: {
        id: site.id,
        siteKey: site.site_key,
        siteLabel: site.site_label,
      },
      setting: setting
        ? {
            id: setting.id,
            isEnabled: setting.is_enabled,
            price: setting.price,
          }
        : {
            id: null,
            isEnabled: false,
            price: 1000,
          },
      members: subscriptions.map((subscription) => {
        const paymentStats = paymentStatsByUserId.get(subscription.subscriber_user_id);

        return {
          id: subscription.id,
          nickname: getNickname({
            subscriberUserId: subscription.subscriber_user_id,
            stigmaIdByParticleId,
            nicknameByStigmaId,
          }),
          status: getMembershipStatus(subscription.status),
          activeMonths: paymentStats?.activeMonths ?? 0,
          lastPaidAt: paymentStats?.lastPaidAt ?? null,
        };
      }),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '멤버십 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '멤버십 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const body = (await request.json()) as {
      isEnabled?: boolean;
      price?: number;
    };

    if (typeof body.isEnabled !== 'boolean') {
      return Response.json({ error: '멤버십 사용 여부가 올바르지 않습니다.' }, { status: 400 });
    }

    if (typeof body.price !== 'number' || !isValidMembershipPrice(body.price)) {
      return Response.json(
        { error: '멤버십 금액은 1,000원부터 100,000원까지 1,000원 단위로 입력해 주세요.' },
        { status: 400 },
      );
    }

    const siteAndSession = await getSiteAndSession(siteName);

    if (siteAndSession.response || !siteAndSession.site) {
      return siteAndSession.response;
    }

    const { site, supabaseAdmin } = siteAndSession;
    const nowIso = new Date().toISOString();

    const existingSettingResult = await supabaseAdmin
      .from('subscription_settings')
      .select('id')
      .eq('target_type', PAYMENT_TARGET_TYPE.BLOG)
      .eq('target_id', site.id)
      .eq('subscription_type', SUBSCRIPTION_TYPE.BLOG_MEMBERSHIP)
      .maybeSingle();

    if (existingSettingResult.error) {
      console.error(existingSettingResult.error);

      return Response.json({ error: '멤버십 설정을 확인하지 못했습니다.' }, { status: 500 });
    }

    const payload = {
      target_type: PAYMENT_TARGET_TYPE.BLOG,
      target_id: site.id,
      subscription_type: SUBSCRIPTION_TYPE.BLOG_MEMBERSHIP,
      is_enabled: body.isEnabled,
      price: body.price,
    };

    const settingResult = existingSettingResult.data
      ? await supabaseAdmin
          .from('subscription_settings')
          .update(payload)
          .eq('id', existingSettingResult.data.id)
          .select('id')
          .single()
      : await supabaseAdmin.from('subscription_settings').insert(payload).select('id').single();

    if (settingResult.error) {
      console.error(settingResult.error);

      return Response.json({ error: '멤버십 설정을 저장하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      settingId: settingResult.data.id,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '멤버십 설정을 저장하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '멤버십 설정을 저장하지 못했습니다.' }, { status: 500 });
  }
}
