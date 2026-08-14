import { getPaymentCustomerName } from '@/lib/payments/customer';
import verifySession from '@/lib/session/verifySession';

export async function GET() {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({
        paymentEmail: null,
      });
    }

    const paymentEmail = await getPaymentCustomerName(session.authUserId);

    return Response.json({
      paymentEmail,
    });
  } catch (unknownError) {
    console.error(unknownError);

    return Response.json({
      paymentEmail: null,
    });
  }
}
