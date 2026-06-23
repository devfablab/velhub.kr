import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { issueTossBillingKey } from '@/lib/payments/toss';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type BillingMethodSuccessBody = {
  authKey?: string;
  customerKey?: string;
  orderNo?: string;
};

type TossBillingKeyResult = {
  mId: string;
  customerKey: string;
  authenticatedAt: string;
  method: string;
  billingKey: string;
  card?: {
    issuerCode?: string;
    acquirerCode?: string;
    number?: string;
    cardType?: string;
    ownerType?: string;
  };
};

type BillingMethodRow = {
  id: string;
  is_default: boolean;
};

const CARD_COMPANY_BY_CODE: Record<string, string> = {
  '3K': '기업BC',
  '46': '광주은행',
  '71': '롯데카드',
  '30': 'KDB산업은행',
  '31': 'BC카드',
  '51': '삼성카드',
  '38': '새마을금고',
  '41': '신한카드',
  '62': '신협',
  '36': '씨티카드',
  '33': '우리카드',
  '37': '우체국',
  '39': '저축은행',
  '35': '전북은행',
  '42': '제주은행',
  '15': '카카오뱅크',
  '3A': '케이뱅크',
  '24': '토스뱅크',
  '21': '하나카드',
  '61': '현대카드',
  '11': 'KB국민카드',
  '91': 'NH농협카드',
  '34': '수협은행',
};

function createCustomerKey(authUserId: string) {
  const customerKeyHash = crypto.createHash('sha256').update(authUserId).digest('hex');

  return `user_${customerKeyHash}`;
}

function getCardCompanyName(cardCompanyCode: string) {
  return CARD_COMPANY_BY_CODE[cardCompanyCode] ?? '알 수 없음';
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BillingMethodSuccessBody;
    const authKey = normalizeText(body.authKey);
    const customerKey = normalizeText(body.customerKey);
    const orderNo = normalizeText(body.orderNo);

    if (!authKey) {
      return Response.json({ error: 'authKey가 유효하지 않습니다.' }, { status: 400 });
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

    const billingKeyResult = (await issueTossBillingKey({
      authKey,
      customerKey,
    })) as TossBillingKeyResult;

    const cardCompanyCode = normalizeText(billingKeyResult.card?.issuerCode);
    const cardCompany = getCardCompanyName(cardCompanyCode);
    const cardNumberMasked = normalizeText(billingKeyResult.card?.number);
    const cardOwnerType = normalizeText(billingKeyResult.card?.ownerType);
    const cardType = normalizeText(billingKeyResult.card?.cardType);

    if (!cardCompanyCode || !cardNumberMasked || !cardOwnerType || !cardType) {
      return Response.json({ error: '카드 정보를 확인하지 못했습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const existingBillingMethodResult = await supabaseAdmin
      .from('subscription_billing_methods')
      .select('id, is_default')
      .eq('user_id', session.authUserId)
      .eq('provider', 'toss')
      .eq('billing_key', billingKeyResult.billingKey)
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
      .eq('provider', 'toss')
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
          card_company: cardCompany,
          card_company_code: cardCompanyCode,
          card_number_masked: cardNumberMasked,
          owner_type: cardOwnerType,
          card_type: cardType,
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
      provider: 'toss',
      customer_key: customerKey,
      billing_key: billingKeyResult.billingKey,
      card_company: cardCompany,
      card_company_code: cardCompanyCode,
      card_number_masked: cardNumberMasked,
      owner_type: cardOwnerType,
      card_type: cardType,
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
