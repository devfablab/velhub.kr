import { NextRequest } from 'next/server';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  PAYMENT_METHOD,
  PAYMENT_PROVIDER,
  PAYMENT_STATUS,
  PAYMENT_TARGET_TYPE,
  PAYMENT_TYPE,
  REFUND_POLICY,
} from '@/lib/payments/types';
import { confirmTossPayment, TossPaymentConfirmError } from '@/lib/payments/toss';

function validateDonationAmount(amount: number) {
  if (!Number.isInteger(amount)) {
    return false;
  }

  if (amount < 1000) {
    return false;
  }

  if (amount > 100000) {
    return false;
  }

  return amount % 1000 === 0;
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = (await request.json()) as {
      paymentKey?: string;
      orderId?: string;
      amount?: number;
      siteId?: string;
    };

    const paymentKey = body.paymentKey?.trim() ?? '';
    const orderId = body.orderId?.trim() ?? '';
    const siteId = body.siteId?.trim() ?? '';
    const amount = body.amount;

    if (!paymentKey || !orderId || !siteId || typeof amount !== 'number') {
      return Response.json({ error: '후원 결제 승인 정보가 없습니다.' }, { status: 400 });
    }

    if (!validateDonationAmount(amount)) {
      return Response.json({ error: '후원금액이 올바르지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const existingPaymentResult = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('payment_key', paymentKey)
      .maybeSingle();

    if (existingPaymentResult.error) {
      console.error(existingPaymentResult.error);

      return Response.json({ error: '결제 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (existingPaymentResult.data) {
      return Response.json({
        ok: true,
        paymentId: existingPaymentResult.data.id,
      });
    }

    const siteResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label, is_shutdown')
      .eq('id', siteId)
      .maybeSingle();

    if (siteResult.error) {
      console.error(siteResult.error);

      return Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!siteResult.data) {
      return Response.json({ error: '사이트 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (siteResult.data.is_shutdown) {
      return Response.json({ error: '현재 후원할 수 없는 사이트입니다.' }, { status: 400 });
    }

    const confirmResult = await confirmTossPayment({
      paymentKey,
      orderId,
      amount,
    });

    const paymentInsertResult = await supabaseAdmin
      .from('payments')
      .insert({
        provider: PAYMENT_PROVIDER.TOSS,
        payment_key: confirmResult.paymentKey,
        order_no: confirmResult.orderId,
        buyer_user_id: session.authUserId,
        amount: confirmResult.totalAmount,
        currency: confirmResult.currency || 'KRW',
        status: PAYMENT_STATUS.PAID,
        payment_method: PAYMENT_METHOD.CARD,
        payment_type: PAYMENT_TYPE.DONATION,
        target_type: PAYMENT_TARGET_TYPE.DONATION,
        target_id: siteResult.data.id,
        subscription_id: null,
        failure_code: null,
        failure_message: null,
        failure_stage: null,
        refund_policy: REFUND_POLICY.DONATION_RESTRICTED,
        refundable_until: null,
        approved_at: confirmResult.approvedAt,
        refunded_at: null,
        raw_data: confirmResult,
      })
      .select('id')
      .single();

    if (paymentInsertResult.error) {
      console.error(paymentInsertResult.error);

      return Response.json({ error: '후원 결제 내역을 저장하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      paymentId: paymentInsertResult.data.id,
    });
  } catch (unknownError) {
    if (unknownError instanceof TossPaymentConfirmError) {
      console.error(unknownError.rawData);

      return Response.json({ error: unknownError.message || '후원 결제 승인에 실패했습니다.' }, { status: 500 });
    }

    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '후원 결제를 완료하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '후원 결제를 완료하지 못했습니다.' }, { status: 500 });
  }
}
