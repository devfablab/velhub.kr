import { NextRequest } from 'next/server';
import { cancelTossPayment } from '@/lib/payments/toss';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RefundDonationBody = {
  paymentId?: string;
};

type PaymentRow = {
  id: string;
  buyer_user_id: string;
  payment_key: string | null;
  payment_type: string;
  target_type: string;
  target_id: string | null;
  order_no: string | null;
  amount: number;
  refunded_amount: number | null;
  status: string;
  refundable_until: string | null;
};

const DONATION_PAYMENT_TYPES = ['donation_site', 'donation_board', 'donation_series', 'donation_post'];

function isRefundableDonation(payment: PaymentRow) {
  if (!DONATION_PAYMENT_TYPES.includes(payment.payment_type)) {
    return false;
  }

  if (payment.status !== 'paid') {
    return false;
  }

  if (!payment.payment_key) {
    return false;
  }

  if (!payment.refundable_until) {
    return false;
  }

  return new Date(payment.refundable_until).getTime() > Date.now();
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = (await request.json()) as RefundDonationBody;
    const paymentId = normalizeText(body.paymentId);

    if (!paymentId) {
      return Response.json({ error: '결제 정보가 없습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const paymentResult = await supabaseAdmin
      .from('payments')
      .select(
        'id, buyer_user_id, payment_key, payment_type, target_type, target_id, order_no, amount, refunded_amount, status, refundable_until',
      )
      .eq('id', paymentId)
      .eq('buyer_user_id', session.authUserId)
      .maybeSingle();

    if (paymentResult.error) {
      console.error(paymentResult.error);

      return Response.json({ error: '결제 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const payment = paymentResult.data as PaymentRow | null;

    if (!payment) {
      return Response.json({ error: '결제 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!isRefundableDonation(payment)) {
      return Response.json({ error: '환불 가능한 후원 결제가 아닙니다.' }, { status: 400 });
    }

    const refundedAmount = payment.refunded_amount ?? 0;
    const refundAmount = payment.amount - refundedAmount;

    if (refundAmount <= 0) {
      return Response.json({ error: '환불 가능한 금액이 없습니다.' }, { status: 400 });
    }

    const cancelResult = await cancelTossPayment({
      paymentKey: payment.payment_key as string,
      cancelReason: '후원 환불 요청',
      cancelAmount: refundAmount,
    });

    const canceledAt = cancelResult.cancels?.[0]?.canceledAt ?? new Date().toISOString();
    const nextRefundedAmount = refundedAmount + refundAmount;

    const updateResult = await supabaseAdmin
      .from('payments')
      .update({
        status: nextRefundedAmount >= payment.amount ? 'refunded' : 'partially_refunded',
        refunded_amount: nextRefundedAmount,
        refunded_at: canceledAt,
        updated_at: new Date().toISOString(),
        raw_data: cancelResult,
      })
      .eq('id', payment.id)
      .eq('buyer_user_id', session.authUserId);

    if (updateResult.error) {
      console.error(updateResult.error);

      return Response.json({ error: '환불 내역을 저장하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      status: nextRefundedAmount >= payment.amount ? 'refunded' : 'partially_refunded',
      refundedAmount: nextRefundedAmount,
      refundedAt: canceledAt,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '후원 환불에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '후원 환불에 실패했습니다.' }, { status: 500 });
  }
}
