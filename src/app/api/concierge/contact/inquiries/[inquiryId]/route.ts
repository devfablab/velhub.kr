import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(_: Request, { params }: { params: Promise<{ inquiryId: string }> }) {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const { inquiryId } = await params;
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('inquiries')
    .select(
      'id, inquiry_type, inquiry_subtype, status, title, content, created_at, closed_at, resolution_code, resolution_summary, information_request_type, information_requested_at, information_due_at, payment_control_requested_at, payment_control_selected_at, pg_cancellation_unavailable_at, manual_refund_ready_at, manual_refund_completed_at, inquiry_orders(payment_id, payments(order_no, amount, status, payment_method, approved_at)), inquiry_bug_details(*), inquiry_payment_details(*), inquiry_messages(id, sender_type, message_type, message, created_at), inquiry_attachments(id, attachment_type, storage_path, storage_bucket, submitted_at, deleted_at)',
    )
    .eq('id', inquiryId)
    .eq('requester_stigma_id', currentStigma.stigmaId)
    .maybeSingle();
  if (error || !data) return Response.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 });
  const evidence = data.inquiry_attachments.find(
    (item) => !item.deleted_at && ['bug_evidence', 'payment_evidence'].includes(item.attachment_type),
  );
  const { data: signed } = evidence
    ? await db.storage.from(evidence.storage_bucket).createSignedUrl(evidence.storage_path, 600)
    : { data: null };
  return Response.json({ inquiry: { ...data, evidenceUrl: signed?.signedUrl ?? null } });
}
