import { encrypt } from '@/lib/encryption/encrypt';
import { issueTossBillingKey } from '@/lib/payments/toss';
import { SUBSCRIPTION_STATUS } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

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

function getCardCompanyName(cardCompanyCode: string) {
  return CARD_COMPANY_BY_CODE[cardCompanyCode] ?? '알 수 없음';
}

function getPurchaseRedirectUrl(request: Request, status: 'success' | 'fail', message?: string) {
  const requestUrl = new URL(request.url);
  const redirectUrl = new URL('/hub/purchase', requestUrl.origin);

  redirectUrl.searchParams.set('billingMethod', status);

  if (message) {
    redirectUrl.searchParams.set('message', message);
  }

  return redirectUrl;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const authKey = normalizeText(requestUrl.searchParams.get('authKey'));
    const customerKey = normalizeText(requestUrl.searchParams.get('customerKey'));

    if (!authKey || !customerKey) {
      return Response.redirect(getPurchaseRedirectUrl(request, 'fail', '결제수단 인증 정보가 올바르지 않습니다.'));
    }

    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.redirect(getPurchaseRedirectUrl(request, 'fail', '로그인이 필요합니다.'));
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
      return Response.redirect(getPurchaseRedirectUrl(request, 'fail', '카드 정보를 확인하지 못했습니다.'));
    }

    const supabaseAdmin = getSupabaseAdmin();

    const existingBillingMethodResult = await supabaseAdmin
      .from('subscription_billing_methods')
      .select('id')
      .eq('user_id', session.authUserId)
      .eq('provider', 'toss')
      .eq('billing_key', billingKeyResult.billingKey)
      .maybeSingle();

    if (existingBillingMethodResult.error) {
      console.error(existingBillingMethodResult.error);

      return Response.redirect(getPurchaseRedirectUrl(request, 'fail', '등록된 결제수단을 확인하지 못했습니다.'));
    }

    const defaultClearResult = await supabaseAdmin
      .from('subscription_billing_methods')
      .update({
        is_default: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', session.authUserId)
      .eq('provider', 'toss')
      .eq('is_default', true);

    if (defaultClearResult.error) {
      console.error(defaultClearResult.error);

      return Response.redirect(getPurchaseRedirectUrl(request, 'fail', '기본 결제수단을 갱신하지 못했습니다.'));
    }

    const existingBillingMethod = existingBillingMethodResult.data as BillingMethodRow | null;
    const nowText = new Date().toISOString();

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
          updated_at: nowText,
        })
        .eq('id', existingBillingMethod.id);

      if (billingMethodUpdateResult.error) {
        console.error(billingMethodUpdateResult.error);

        return Response.redirect(getPurchaseRedirectUrl(request, 'fail', '결제수단을 갱신하지 못했습니다.'));
      }
    } else {
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

        return Response.redirect(getPurchaseRedirectUrl(request, 'fail', '결제수단을 저장하지 못했습니다.'));
      }
    }

    const subscriptionUpdateResult = await supabaseAdmin
      .from('subscriptions')
      .update({
        billing_key: encrypt(billingKeyResult.billingKey),
        customer_key: customerKey,
        updated_at: nowText,
      })
      .eq('subscriber_user_id', session.authUserId)
      .in('status', [SUBSCRIPTION_STATUS.TRIALING, SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PAST_DUE])
      .is('expired_at', null);

    if (subscriptionUpdateResult.error) {
      console.error(subscriptionUpdateResult.error);

      return Response.redirect(getPurchaseRedirectUrl(request, 'fail', '구독 결제수단을 갱신하지 못했습니다.'));
    }

    return Response.redirect(getPurchaseRedirectUrl(request, 'success'));
  } catch (unknownError) {
    const message =
      unknownError instanceof Error
        ? unknownError.message || '결제수단을 변경하지 못했습니다.'
        : '결제수단을 변경하지 못했습니다.';

    return Response.redirect(getPurchaseRedirectUrl(request, 'fail', message));
  }
}
