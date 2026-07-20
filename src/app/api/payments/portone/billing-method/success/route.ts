import { NextRequest } from 'next/server';
import { encrypt } from '@/lib/encryption/encrypt';
import { getCurrentPortOneProvider, getPortOneBillingCardInfo, getPortOneBillingKeyInfo } from '@/lib/payments/portone';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { createCustomerKey } from '@/lib/payments/customer';
import { PAYMENT_TARGET_TYPE, SUBSCRIPTION_STATUS, SUBSCRIPTION_TYPE } from '@/lib/payments/types';

type BillingMethodSuccessBody = {
  billingKey?: string;
  customerKey?: string;
  orderNo?: string;
  siteId?: string;
};

type BillingMethodRow = {
  id: string;
  is_default: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BillingMethodSuccessBody;
    const billingKey = normalizeText(body.billingKey);
    const customerKey = normalizeText(body.customerKey);
    const orderNo = normalizeText(body.orderNo);
    const siteId = normalizeText(body.siteId);

    if (!billingKey) {
      return Response.json({ error: 'billingKey가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!customerKey) {
      return Response.json({ error: 'customerKey가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!orderNo) {
      return Response.json({ error: 'orderNo가 유효하지 않습니다.' }, { status: 400 });
    }

    const session = await verifySession({ siteId: siteId || null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (siteId && session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const expectedCustomerKey = createCustomerKey(session.authUserId);

    if (customerKey !== expectedCustomerKey) {
      return Response.json({ error: '결제 수단 등록 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    const billingKeyInfo = await getPortOneBillingKeyInfo(billingKey);

    if (billingKeyInfo.status !== 'ISSUED') {
      return Response.json({ error: '발급된 빌링키를 확인하지 못했습니다.' }, { status: 400 });
    }

    let cardInfo: ReturnType<typeof getPortOneBillingCardInfo>;

    try {
      cardInfo = getPortOneBillingCardInfo(billingKeyInfo);
    } catch (unknownError) {
      console.error('PortOne billing method card parse failed:', billingKeyInfo);

      return Response.json(
        {
          error: unknownError instanceof Error ? unknownError.message : '빌링키 카드 정보를 확인하지 못했습니다.',
          debug: process.env.NODE_ENV === 'development' ? { billingKeyInfo } : undefined,
        },
        { status: 500 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    async function updatePlanBillingSubscription() {
      if (!siteId || !session.authUserId) {
        return;
      }

      const subscriptionResult = await supabaseAdmin
        .from('subscriptions')
        .select('id, status, expired_at')
        .eq('subscription_type', SUBSCRIPTION_TYPE.PLAN_BILLING)
        .eq('target_type', PAYMENT_TARGET_TYPE.PLAN)
        .eq('target_id', siteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscriptionResult.error) {
        console.error(subscriptionResult.error);
        throw new Error('요금제 구독 정보를 확인하지 못했습니다.');
      }

      const subscription = subscriptionResult.data;

      if (
        !subscription ||
        subscription.expired_at ||
        subscription.status === SUBSCRIPTION_STATUS.CANCELED ||
        subscription.status === SUBSCRIPTION_STATUS.EXPIRED
      ) {
        return;
      }

      const subscriptionUpdateResult = await supabaseAdmin
        .from('subscriptions')
        .update({
          subscriber_user_id: session.authUserId,
          billing_key: encrypt(billingKey),
          customer_key: customerKey,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (subscriptionUpdateResult.error) {
        console.error(subscriptionUpdateResult.error);
        throw new Error('요금제 결제수단을 변경하지 못했습니다.');
      }
    }

    const existingBillingMethodResult = await supabaseAdmin
      .from('subscription_billing_methods')
      .select('id, is_default')
      .eq('user_id', session.authUserId)
      .eq('provider', getCurrentPortOneProvider())
      .eq('billing_key', billingKey)
      .maybeSingle();

    if (existingBillingMethodResult.error) {
      console.error(existingBillingMethodResult.error);

      return Response.json({ error: '등록된 결제 수단을 확인하지 못했습니다.' }, { status: 500 });
    }

    const clearDefaultResult = await supabaseAdmin
      .from('subscription_billing_methods')
      .update({
        is_default: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', session.authUserId)
      .eq('provider', getCurrentPortOneProvider())
      .eq('is_default', true);

    if (clearDefaultResult.error) {
      console.error(clearDefaultResult.error);

      return Response.json({ error: '기본 결제 수단을 갱신하지 못했습니다.' }, { status: 500 });
    }

    const existingBillingMethod = existingBillingMethodResult.data as BillingMethodRow | null;

    if (existingBillingMethod) {
      const billingMethodUpdateResult = await supabaseAdmin
        .from('subscription_billing_methods')
        .update({
          customer_key: customerKey,
          card_company: cardInfo.cardCompany,
          card_number_masked: cardInfo.cardNumberMasked,
          owner_type: cardInfo.ownerType,
          card_type: cardInfo.cardType,
          is_default: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingBillingMethod.id);

      if (billingMethodUpdateResult.error) {
        console.error(billingMethodUpdateResult.error);

        return Response.json({ error: '결제 수단을 갱신하지 못했습니다.' }, { status: 500 });
      }

      await updatePlanBillingSubscription();

      return Response.json({ ok: true });
    }

    const billingMethodInsertResult = await supabaseAdmin.from('subscription_billing_methods').insert({
      user_id: session.authUserId,
      provider: getCurrentPortOneProvider(),
      customer_key: customerKey,
      billing_key: billingKey,
      card_company: cardInfo.cardCompany,
      card_number_masked: cardInfo.cardNumberMasked,
      owner_type: cardInfo.ownerType,
      card_type: cardInfo.cardType,
      is_default: true,
    });

    if (billingMethodInsertResult.error) {
      console.error(billingMethodInsertResult.error);

      return Response.json({ error: '결제 수단을 저장하지 못했습니다.' }, { status: 500 });
    }

    await updatePlanBillingSubscription();

    return Response.json({ ok: true });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '결제 수단을 추가하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '결제 수단을 추가하지 못했습니다.' }, { status: 500 });
  }
}
