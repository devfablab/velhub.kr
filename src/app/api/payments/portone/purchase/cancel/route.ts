import { calculateDonationRefundAmount } from '@/lib/payments/refunds';
import { cancelPortOnePayment } from '@/lib/payments/portone';
import { PAYMENT_STATUS, PAYMENT_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type CancelPostPurchaseBody = {
  paymentId?: string;
  isManualException?: boolean;
};

type PaymentRow = {
  id: string;
  buyer_user_id: string;
  payment_key: string | null;
  amount: number;
  refunded_amount: number | null;
  status: string;
  payment_type: string;
  approved_at: string | null;
  created_at: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CancelPostPurchaseBody;
    const paymentId = normalizeText(body.paymentId);
    const isManualException = body.isManualException === true;

    if (!paymentId) {
      return Response.json({ error: 'paymentId가 유효하지 않습니다.' }, { status: 400 });
    }

    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const now = new Date();
    const nowText = now.toISOString();

    const paymentResult = await supabaseAdmin
      .from('payments')
      .select(
        [
          'id',
          'buyer_user_id',
          'payment_key',
          'amount',
          'refunded_amount',
          'status',
          'payment_type',
          'approved_at',
          'created_at',
        ].join(', '),
      )
      .eq('id', paymentId)
      .eq('payment_type', PAYMENT_TYPE.PURCHASE_POST)
      .maybeSingle();

    if (paymentResult.error) {
      console.error(paymentResult.error);

      return Response.json({ error: '포스팅 구매 결제 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!paymentResult.data) {
      return Response.json({ error: '포스팅 구매 결제 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const payment = paymentResult.data as unknown as PaymentRow;

    if (payment.buyer_user_id !== session.authUserId) {
      return Response.json({ error: '본인의 포스팅 구매 결제만 취소할 수 있습니다.' }, { status: 403 });
    }

    if (payment.status === PAYMENT_STATUS.REFUNDED) {
      return Response.json({ error: '이미 환불된 포스팅 구매입니다.' }, { status: 400 });
    }

    if (payment.status !== PAYMENT_STATUS.PAID) {
      return Response.json({ error: '환불할 수 없는 포스팅 구매 상태입니다.' }, { status: 400 });
    }

    if ((payment.refunded_amount ?? 0) > 0) {
      return Response.json({ error: '이미 환불 처리가 진행된 포스팅 구매입니다.' }, { status: 400 });
    }

    const paidAt = payment.approved_at ?? payment.created_at;
    const refundCalculation = calculateDonationRefundAmount({
      amount: payment.amount,
      paidAt,
      now,
      isManualException,
    });

    if (!refundCalculation.isRefundable) {
      return Response.json({ error: '환불 가능 기간이 지난 포스팅 구매입니다.' }, { status: 400 });
    }

    if (!payment.payment_key) {
      return Response.json({ error: '결제 취소에 필요한 paymentId가 없습니다.' }, { status: 400 });
    }

    const cancelResult = await cancelPortOnePayment({
      paymentId: payment.payment_key,
      cancelReason: '포스팅 구매 환불',
    });

    const paymentUpdateResult = await supabaseAdmin
      .from('payments')
      .update({
        status: PAYMENT_STATUS.REFUNDED,
        refunded_amount: payment.amount,
        refunded_at: nowText,
        raw_data: cancelResult,
      })
      .eq('id', payment.id);

    if (paymentUpdateResult.error) {
      console.error(paymentUpdateResult.error);

      return Response.json({ error: '포스팅 구매 환불 정보를 저장하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      mode: 'full_refund',
      refundAmount: payment.amount,
      retainedAmount: 0,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '포스팅 구매 환불에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '포스팅 구매 환불에 실패했습니다.' }, { status: 500 });
  }
}
