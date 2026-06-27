import crypto from 'crypto';
import { encrypt } from '@/lib/encryption/encrypt';
import { getCurrentPortOneProvider, getPortOneBillingCardInfo, getPortOneBillingKeyInfo } from '@/lib/payments/portone';
import { SUBSCRIPTION_STATUS } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { createCustomerKey } from '@/lib/payments/customer';

type BillingMethodRow = {
  id: string;
};

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
    const billingKey = normalizeText(requestUrl.searchParams.get('billingKey'));
    const customerKey = normalizeText(requestUrl.searchParams.get('customerKey'));

    if (!billingKey || !customerKey) {
      return Response.redirect(getPurchaseRedirectUrl(request, 'fail', '결제수단 인증 정보가 올바르지 않습니다.'));
    }

    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.redirect(getPurchaseRedirectUrl(request, 'fail', '로그인이 필요합니다.'));
    }

    const expectedCustomerKey = createCustomerKey(session.authUserId);

    if (customerKey !== expectedCustomerKey) {
      return Response.redirect(getPurchaseRedirectUrl(request, 'fail', '결제수단 인증 정보가 올바르지 않습니다.'));
    }

    const billingKeyInfo = await getPortOneBillingKeyInfo(billingKey);

    if (billingKeyInfo.status !== 'ISSUED') {
      return Response.redirect(getPurchaseRedirectUrl(request, 'fail', '발급된 빌링키를 확인하지 못했습니다.'));
    }

    const cardInfo = getPortOneBillingCardInfo(billingKeyInfo);
    const supabaseAdmin = getSupabaseAdmin();
    const provider = getCurrentPortOneProvider();

    const existingBillingMethodResult = await supabaseAdmin
      .from('subscription_billing_methods')
      .select('id')
      .eq('user_id', session.authUserId)
      .eq('provider', provider)
      .eq('billing_key', billingKey)
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
      .eq('provider', provider)
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
          card_company: cardInfo.cardCompany,
          card_number_masked: cardInfo.cardNumberMasked,
          owner_type: cardInfo.ownerType,
          card_type: cardInfo.cardType,
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
        provider,
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

        return Response.redirect(getPurchaseRedirectUrl(request, 'fail', '결제수단을 저장하지 못했습니다.'));
      }
    }

    const subscriptionUpdateResult = await supabaseAdmin
      .from('subscriptions')
      .update({
        billing_key: encrypt(billingKey),
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
