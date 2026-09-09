import { getPaymentCustomerName, getPaymentCustomerPhone } from '@/lib/payments/customer';
import verifySession from '@/lib/session/verifySession';

export async function GET() {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({
        paymentEmail: null,
        paymentPhone: null,
      });
    }

    const [paymentEmail, paymentPhone] = await Promise.all([
      getPaymentCustomerName(session.authUserId),
      getPaymentCustomerPhone(session.authUserId),
    ]);

    return Response.json({
      paymentEmail,
      paymentPhone,
    });
  } catch (unknownError) {
    console.error(unknownError);

    return Response.json({
      paymentEmail: null,
      paymentPhone: null,
    });
  }
}
