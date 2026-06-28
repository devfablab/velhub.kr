import { NextRequest } from 'next/server';
import { getCurrentPortOneProvider, getPortOneBillingCardInfo, getPortOneBillingKeyInfo } from '@/lib/payments/portone';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { createCustomerKey } from '@/lib/payments/customer';

type BillingMethodSuccessBody = {
  billingKey?: string;
  customerKey?: string;
  orderNo?: string;
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

    if (!billingKey) {
      return Response.json({ error: 'billingKey가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!customerKey) {
      return Response.json({ error: 'customerKey가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!orderNo) {
      return Response.json({ error: 'orderNo가 유효하지 않습니다.' }, { status: 400 });
    }

    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
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

    return Response.json({ ok: true });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '결제 수단을 추가하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '결제 수단을 추가하지 못했습니다.' }, { status: 500 });
  }
}
