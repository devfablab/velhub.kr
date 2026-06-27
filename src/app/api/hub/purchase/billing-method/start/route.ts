import crypto from 'crypto';
import { getPortOneKpnSubscriptionChannelKey, getPortOneStoreId } from '@/lib/payments/portone';
import verifySession from '@/lib/session/verifySession';
import { createCustomerKey, getPaymentCustomerName } from '@/lib/payments/customer';

function createOrderNo() {
  const randomText = crypto.randomBytes(8).toString('hex');
  const timestamp = Date.now();

  return `VH-BILL-METHOD-${timestamp}-${randomText}`;
}

function getBaseUrl(request: Request) {
  const requestUrl = new URL(request.url);

  return requestUrl.origin;
}

export async function POST(request: Request) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const baseUrl = getBaseUrl(request);
    const customerKey = createCustomerKey(session.authUserId);
    const customerName = await getPaymentCustomerName(session.authUserId);
    const orderNo = createOrderNo();
    const successUrl = new URL('/api/hub/purchase/billing-method/success', baseUrl);
    const failUrl = new URL('/hub/purchase', baseUrl);

    successUrl.searchParams.set('orderNo', orderNo);
    successUrl.searchParams.set('customerKey', customerKey);

    failUrl.searchParams.set('billingMethod', 'fail');
    failUrl.searchParams.set('orderNo', orderNo);

    return Response.json({
      storeId: getPortOneStoreId(),
      channelKey: getPortOneKpnSubscriptionChannelKey(),
      customerKey,
      customerName,
      orderNo,
      orderName: '데브허브 결제 수단 변경',
      successUrl: successUrl.toString(),
      failUrl: failUrl.toString(),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '결제수단 변경을 시작하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '결제수단 변경을 시작하지 못했습니다.' }, { status: 500 });
  }
}
