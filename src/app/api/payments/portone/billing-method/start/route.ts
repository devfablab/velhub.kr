import { NextRequest } from 'next/server';
import { createCustomerKey, getPaymentCustomerName, getPaymentCustomerPhone } from '@/lib/payments/customer';
import { createPaymentOrderNo } from '@/lib/payments/orderNo';
import { getPortOneKpnSubscriptionChannelKey, getPortOneStoreId } from '@/lib/payments/portone';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';

type BillingMethodStartBody = {
  orderName?: string;
  successUrl?: string;
  failUrl?: string;
};

function getSafeRedirectUrl(request: NextRequest, url: string | undefined) {
  if (!url) {
    throw new Error('이동할 주소가 없습니다.');
  }

  const parsedUrl = new URL(url, request.nextUrl.origin);

  if (parsedUrl.origin !== request.nextUrl.origin) {
    throw new Error('이동할 주소가 올바르지 않습니다.');
  }

  return parsedUrl;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BillingMethodStartBody;
    const orderName = normalizeText(body.orderName) || '데브허브 결제 수단 추가';
    const successUrl = getSafeRedirectUrl(request, body.successUrl);
    const failUrl = getSafeRedirectUrl(request, body.failUrl);

    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const customerKey = createCustomerKey(session.authUserId);
    const customerName = await getPaymentCustomerName(session.authUserId);
    const customerPhone = await getPaymentCustomerPhone(session.authUserId);

    if (!customerName) {
      return Response.json({ paymentEmailRequired: true });
    }

    if (!customerPhone) {
      return Response.json({ error: '본인인증된 휴대전화 번호를 확인하지 못했습니다.' }, { status: 400 });
    }

    const orderNo = createPaymentOrderNo('BILLING_METHOD');

    successUrl.searchParams.set('orderNo', orderNo);
    successUrl.searchParams.set('customerKey', customerKey);

    failUrl.searchParams.set('orderNo', orderNo);

    return Response.json({
      storeId: getPortOneStoreId(),
      channelKey: getPortOneKpnSubscriptionChannelKey(),
      customerKey,
      customerName,
      customerPhone,
      orderNo,
      orderName,
      successUrl: successUrl.toString(),
      failUrl: failUrl.toString(),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '결제 수단 추가를 시작하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '결제 수단 추가를 시작하지 못했습니다.' }, { status: 500 });
  }
}
