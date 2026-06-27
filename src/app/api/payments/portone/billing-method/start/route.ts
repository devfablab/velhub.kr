import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { getPortOneKpnSubscriptionChannelKey, getPortOneStoreId } from '@/lib/payments/portone';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';
import { createCustomerKey, getPaymentCustomerName } from '@/lib/payments/customer';

type BillingMethodStartBody = {
  orderName?: string;
  successUrl?: string;
  failUrl?: string;
};

function createOrderNo() {
  const randomText = crypto.randomBytes(8).toString('hex');
  const timestamp = Date.now();

  return `VH-BILL-METHOD-${timestamp}-${randomText}`;
}

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
    const orderNo = createOrderNo();

    successUrl.searchParams.set('orderNo', orderNo);
    successUrl.searchParams.set('customerKey', customerKey);

    failUrl.searchParams.set('orderNo', orderNo);

    return Response.json({
      storeId: getPortOneStoreId(),
      channelKey: getPortOneKpnSubscriptionChannelKey(),
      customerKey,
      customerName,
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
