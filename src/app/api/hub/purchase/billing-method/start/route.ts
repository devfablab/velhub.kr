import crypto from 'crypto';
import { getTossClientKey } from '@/lib/payments/toss';
import verifySession from '@/lib/session/verifySession';

function createCustomerKey(authUserId: string) {
  const customerKeyHash = crypto.createHash('sha256').update(authUserId).digest('hex');

  return `user_${customerKeyHash}`;
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
    const successUrl = new URL('/api/hub/purchase/billing-method/success', baseUrl);
    const failUrl = new URL('/hub/purchase', baseUrl);

    failUrl.searchParams.set('billingMethod', 'fail');

    return Response.json({
      clientKey: getTossClientKey(),
      customerKey,
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
