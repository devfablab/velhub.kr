import { sendInquiryResultEmail } from '@/lib/notifications/inquiryResultEmail';
import { sendMinorPurchaseCancellationAdjustmentEmail } from '@/lib/notifications/minorPurchaseCancellationEmail';
import { cancelPortOnePayment } from '@/lib/payments/portone';
import { PAYMENT_STATUS, SUBSCRIPTION_STATUS } from '@/lib/payments/types';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(_: Request, { params }: { params: Promise<{ inquiryId: string }> }) {
  const admin = await getCurrentStigma();
  if (!admin) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (admin.role !== 'admin') return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  const { inquiryId } = await params;
  const db = getSupabaseAdmin();
  const { data: inquiry } = await db
    .from('inquiries')
    .select('id, requester_stigma_id, inquiry_type, status, payment_control_selected_at, inquiry_orders(payment_id)')
    .eq('id', inquiryId)
    .maybeSingle();
  if (!inquiry || inquiry.inquiry_type !== 'minor_purchase_cancellation' || inquiry.status === 'closed')
    return Response.json({ error: '처리할 청약취소 문의를 찾을 수 없습니다.' }, { status: 400 });
  if (!inquiry.payment_control_selected_at)
    return Response.json({ error: '계정주의 향후 결제 방침 선택이 필요합니다.' }, { status: 400 });
  const paymentId = inquiry.inquiry_orders?.[0]?.payment_id;
  const { data: payment } = paymentId
    ? await db
        .from('payments')
        .select('id, payment_key, amount, status, target_type, target_id')
        .eq('id', paymentId)
        .maybeSingle()
    : { data: null };
  if (!payment?.payment_key || payment.status !== PAYMENT_STATUS.PAID)
    return Response.json({ error: '취소할 수 있는 결제를 찾을 수 없습니다.' }, { status: 400 });
  let cancelResult: unknown;
  try {
    cancelResult = await cancelPortOnePayment({
      paymentId: payment.payment_key,
      cancelReason: '미성년자 결제 청약취소',
    });
  } catch (error) {
    const failedAt = new Date().toISOString();
    const { data: failedSplits } = await db
      .from('payment_splits')
      .select('id, receiver_user_id, amount')
      .eq('payment_id', payment.id)
      .not('receiver_user_id', 'is', null);
    const failedSplitIds = (failedSplits ?? []).map((split) => split.id);
    const { data: settledItems } = failedSplitIds.length
      ? await db.from('settlement_items').select('payment_split_id').in('payment_split_id', failedSplitIds)
      : { data: [] };
    const settledIds = new Set((settledItems ?? []).map((item) => item.payment_split_id));
    for (const split of failedSplits ?? []) {
      if (!settledIds.has(split.id) || !split.receiver_user_id || Number(split.amount) <= 0) continue;
      await db.from('creator_settlement_adjustments').upsert(
        {
          inquiry_id: inquiryId,
          source_payment_id: payment.id,
          source_payment_split_id: split.id,
          receiver_user_id: split.receiver_user_id,
          amount: split.amount,
          remaining_amount: split.amount,
          effective_at: failedAt,
        },
        { onConflict: 'source_payment_split_id' },
      );
    }
    await db.from('inquiries').update({ pg_cancellation_unavailable_at: failedAt }).eq('id', inquiryId);
    return Response.json(
      {
        error: error instanceof Error ? error.message : '원결제수단 취소가 불가능합니다.',
        pgCancellationUnavailable: true,
      },
      { status: 409 },
    );
  }
  const now = new Date().toISOString();
  const { error: paymentError } = await db
    .from('payments')
    .update({
      status: PAYMENT_STATUS.REFUNDED,
      refunded_amount: payment.amount,
      refunded_at: now,
      raw_data: cancelResult,
    })
    .eq('id', payment.id);
  if (paymentError) return Response.json({ error: '결제 취소 결과를 저장하지 못했습니다.' }, { status: 500 });
  await db
    .from('subscriptions')
    .update({ status: SUBSCRIPTION_STATUS.CANCELED, canceled_at: now, expired_at: now, next_billing_at: null })
    .eq('last_payment_id', payment.id);
  const { data: splits } = await db
    .from('payment_splits')
    .select('id, receiver_user_id, amount')
    .eq('payment_id', payment.id)
    .not('receiver_user_id', 'is', null);
  const splitIds = (splits ?? []).map((split) => split.id);
  const { data: settledItems } = splitIds.length
    ? await db.from('settlement_items').select('payment_split_id').in('payment_split_id', splitIds)
    : { data: [] };
  const settledIds = new Set((settledItems ?? []).map((item) => item.payment_split_id));
  for (const split of splits ?? []) {
    if (!settledIds.has(split.id) || !split.receiver_user_id || Number(split.amount) <= 0) continue;
    const { error: adjustmentError } = await db.from('creator_settlement_adjustments').insert({
      inquiry_id: inquiryId,
      source_payment_id: payment.id,
      source_payment_split_id: split.id,
      receiver_user_id: split.receiver_user_id,
      amount: split.amount,
      remaining_amount: split.amount,
      effective_at: now,
    });
    if (adjustmentError)
      return Response.json({ error: '창작자 정산조정 내역을 생성하지 못했습니다.' }, { status: 500 });
    const { data: receiver } = await db
      .from('stigmas')
      .select('email')
      .or(`id.eq.${split.receiver_user_id},user_id.eq.${split.receiver_user_id}`)
      .limit(1)
      .maybeSingle();
    if (receiver?.email)
      await sendMinorPurchaseCancellationAdjustmentEmail({
        email: receiver.email,
        adjustmentAmount: Number(split.amount),
      }).catch(() => null);
  }
  const summary = '미성년 이용자의 법정대리인 요청을 확인하여 청약취소를 승인하고 원결제수단으로 결제를 취소했습니다.';
  await db
    .from('inquiries')
    .update({
      status: 'closed',
      resolution_code: 'minor_cancellation_approved_payment_cancelled',
      resolution_summary: summary,
      resolved_by_stigma_id: admin.stigmaId,
      closed_at: now,
    })
    .eq('id', inquiryId);
  const purgeAfter = new Date();
  purgeAfter.setFullYear(purgeAfter.getFullYear() + 5);
  await db
    .from('inquiry_attachments')
    .update({ purge_after: purgeAfter.toISOString() })
    .eq('inquiry_id', inquiryId)
    .is('deleted_at', null);
  await db.from('inquiry_status').insert({
    inquiry_id: inquiryId,
    previous_status: inquiry.status,
    next_status: 'closed',
    changed_by_stigma_id: admin.stigmaId,
    reason: summary,
  });
  const { data: requester } = await db
    .from('stigmas')
    .select('email')
    .eq('id', inquiry.requester_stigma_id)
    .maybeSingle();
  if (requester?.email)
    await sendInquiryResultEmail({
      email: requester.email,
      result: '청약취소 승인 및 결제 취소 완료',
      reason: summary,
    }).catch(() => null);
  return Response.json({ ok: true });
}
