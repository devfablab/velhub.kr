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
    .select('inquiry_type, status, pg_cancellation_unavailable_at, inquiry_orders(payment_id)')
    .eq('id', inquiryId)
    .maybeSingle();
  if (
    !inquiry ||
    inquiry.inquiry_type !== 'minor_purchase_cancellation' ||
    inquiry.status === 'closed' ||
    inquiry.pg_cancellation_unavailable_at
  )
    return Response.json({ error: '원결제수단 취소 불가로 처리할 수 있는 문의가 아닙니다.' }, { status: 400 });

  const paymentId = inquiry.inquiry_orders?.[0]?.payment_id;
  if (!paymentId) return Response.json({ error: '결제 정보를 찾을 수 없습니다.' }, { status: 404 });
  const now = new Date().toISOString();
  const { data: splits, error: splitError } = await db
    .from('payment_splits')
    .select('id, receiver_user_id, amount')
    .eq('payment_id', paymentId)
    .not('receiver_user_id', 'is', null);
  if (splitError) return Response.json({ error: '정산 분배 내역을 확인하지 못했습니다.' }, { status: 500 });

  const splitIds = (splits ?? []).map((split) => split.id);
  const { data: settledItems } = splitIds.length
    ? await db.from('settlement_items').select('payment_split_id').in('payment_split_id', splitIds)
    : { data: [] };
  const settledIds = new Set((settledItems ?? []).map((item) => item.payment_split_id));
  for (const split of splits ?? []) {
    if (!settledIds.has(split.id) || !split.receiver_user_id || Number(split.amount) <= 0) continue;
    const { data: existingAdjustment } = await db
      .from('creator_settlement_adjustments')
      .select('id')
      .eq('source_payment_split_id', split.id)
      .maybeSingle();
    const { error } = existingAdjustment
      ? { error: null }
      : await db.from('creator_settlement_adjustments').insert({
          inquiry_id: inquiryId,
          source_payment_id: paymentId,
          source_payment_split_id: split.id,
          receiver_user_id: split.receiver_user_id,
          amount: split.amount,
          remaining_amount: split.amount,
          effective_at: now,
        });
    if (error) return Response.json({ error: '창작자 정산조정 내역을 생성하지 못했습니다.' }, { status: 500 });
  }

  await db.from('payment_splits').update({ settlement_blocked_at: now }).eq('payment_id', paymentId);
  const { error: updateError } = await db
    .from('inquiries')
    .update({ pg_cancellation_unavailable_at: now })
    .eq('id', inquiryId);
  if (updateError) return Response.json({ error: '원결제수단 취소 불가 상태를 저장하지 못했습니다.' }, { status: 500 });

  await db.from('inquiry_messages').insert({
    inquiry_id: inquiryId,
    sender_type: 'admin',
    sender_stigma_id: admin.stigmaId,
    message_type: 'system',
    message: '원결제수단 취소가 불가능한 것으로 확인되어 예외 반환 절차를 진행합니다.',
  });
  return Response.json({ ok: true });
}
