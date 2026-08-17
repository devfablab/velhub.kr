import { sendInquiryResultEmail } from '@/lib/notifications/inquiryResultEmail';
import { sendMinorPurchaseCancellationAdjustmentEmail } from '@/lib/notifications/minorPurchaseCancellationEmail';
import { PAYMENT_STATUS, PAYMENT_TARGET_TYPE, SUBSCRIPTION_STATUS } from '@/lib/payments/types';
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
    .select(
      'requester_stigma_id, inquiry_type, status, pg_cancellation_unavailable_at, manual_refund_ready_at, manual_refund_completed_at, inquiry_orders(payment_id)',
    )
    .eq('id', inquiryId)
    .maybeSingle();
  if (
    !inquiry ||
    inquiry.inquiry_type !== 'minor_purchase_cancellation' ||
    inquiry.status === 'closed' ||
    inquiry.manual_refund_completed_at ||
    !inquiry.pg_cancellation_unavailable_at ||
    !inquiry.manual_refund_ready_at
  )
    return Response.json({ error: '예외 반환 준비가 완료되지 않았습니다.' }, { status: 400 });
  const { data: adjustments } = await db
    .from('creator_settlement_adjustments')
    .select('receiver_user_id, amount, remaining_amount')
    .eq('inquiry_id', inquiryId);
  if ((adjustments ?? []).some((item) => Number(item.remaining_amount) > 0))
    return Response.json({ error: '회수되지 않은 창작자 정산조정액이 남아 있습니다.' }, { status: 400 });
  const paymentId = inquiry.inquiry_orders?.[0]?.payment_id;
  const { data: payment } = paymentId
    ? await db.from('payments').select('amount, status, target_type, target_id').eq('id', paymentId).maybeSingle()
    : { data: null };
  if (!payment) return Response.json({ error: '결제 정보를 찾을 수 없습니다.' }, { status: 404 });
  if (payment.status === PAYMENT_STATUS.REFUNDED)
    return Response.json({ error: '이미 반환이 완료된 결제입니다.' }, { status: 400 });
  const now = new Date().toISOString();
  await db
    .from('payments')
    .update({ status: PAYMENT_STATUS.REFUNDED, refunded_amount: payment.amount, refunded_at: now })
    .eq('id', paymentId);
  await db
    .from('subscriptions')
    .update({ status: SUBSCRIPTION_STATUS.CANCELED, canceled_at: now, expired_at: now, next_billing_at: null })
    .eq('last_payment_id', paymentId);
  if (payment.target_type === PAYMENT_TARGET_TYPE.MEMBERSHIP && payment.target_id) {
    await db.from('membership_items').delete().eq('membership_id', payment.target_id);
    await db.from('memberships').delete().eq('id', payment.target_id);
  }
  const purgeAfter = new Date();
  purgeAfter.setFullYear(purgeAfter.getFullYear() + 5);
  await db
    .from('inquiry_refund_accounts')
    .update({ returned_at: now, purge_after: purgeAfter.toISOString() })
    .eq('inquiry_id', inquiryId);
  await db
    .from('inquiry_attachments')
    .update({ purge_after: purgeAfter.toISOString() })
    .eq('inquiry_id', inquiryId)
    .is('deleted_at', null);
  const summary = '원결제수단 취소가 불가능하여 확인된 반환 계좌로 전액 반환을 완료했습니다.';
  await db
    .from('inquiries')
    .update({
      status: 'closed',
      resolution_code: 'minor_cancellation_approved_payment_cancelled',
      resolution_summary: summary,
      manual_refund_completed_at: now,
      resolved_by_stigma_id: admin.stigmaId,
      closed_at: now,
    })
    .eq('id', inquiryId);
  await db.from('inquiry_status').insert({
    inquiry_id: inquiryId,
    previous_status: inquiry.status,
    next_status: 'closed',
    changed_by_stigma_id: admin.stigmaId,
    reason: summary,
  });
  for (const adjustment of adjustments ?? []) {
    const { data: receiver } = await db
      .from('stigmas')
      .select('email')
      .or(`id.eq.${adjustment.receiver_user_id},user_id.eq.${adjustment.receiver_user_id}`)
      .limit(1)
      .maybeSingle();
    if (receiver?.email)
      await sendMinorPurchaseCancellationAdjustmentEmail({
        email: receiver.email,
        adjustmentAmount: Number(adjustment.amount),
      }).catch(() => null);
  }
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
