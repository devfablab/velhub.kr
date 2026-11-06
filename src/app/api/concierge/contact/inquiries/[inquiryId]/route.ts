import { r2Storage } from '@/lib/clients/r2Storage';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { getCurrentStigma } from '@/lib/session/utils';

const attachmentLabels: Record<string, string> = {
  bug_evidence: '버그 신고 증빙 파일',
  family_relation_certificate: '가족관계증명서',
  payment_evidence: '결제 문의 증빙 파일',
};

export async function GET(_: Request, { params }: { params: Promise<{ inquiryId: string }> }) {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const { inquiryId } = await params;
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('inquiries')
    .select(
      'id, inquiry_type, inquiry_subtype, status, title, content, created_at, closed_at, resolution_code, resolution_summary, information_request_type, information_requested_at, information_due_at, payment_control_requested_at, payment_control_selected_at, pg_cancellation_unavailable_at, manual_refund_ready_at, manual_refund_completed_at, inquiry_orders(payment_id, payment_label, payments(order_no, amount, status, payment_method, approved_at, refunded_amount, refunded_at)), inquiry_bug_details(*), inquiry_payment_details(*), inquiry_messages(id, sender_type, message_type, message, created_at), inquiry_attachments(id, attachment_type, storage_path, storage_bucket, submitted_at, deleted_at)',
    )
    .eq('id', inquiryId)
    .eq('requester_stigma_id', currentStigma.stigmaId)
    .maybeSingle();
  if (error || !data) return Response.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 });
  const { data: identity } = await db
    .from('chorogons')
    .select('parent_relationship_verified_at')
    .eq('user_id', currentStigma.stigmaId)
    .maybeSingle();
  const evidence = data.inquiry_attachments.find(
    (item) => !item.deleted_at && ['bug_evidence', 'payment_evidence'].includes(item.attachment_type),
  );
  const [{ data: signed }, attachments] = await Promise.all([
    evidence
      ? await r2Storage.from(evidence.storage_bucket).createSignedUrl(evidence.storage_path, 600)
      : Promise.resolve({ data: null }),
    Promise.all(
      data.inquiry_attachments
        .filter((item) => !item.deleted_at)
        .map(async (item) => {
          const { data: attachmentUrl } = await r2Storage
            .from(item.storage_bucket)
            .createSignedUrl(item.storage_path, 600);
          return attachmentUrl?.signedUrl
            ? {
                id: item.id,
                name: attachmentLabels[item.attachment_type] ?? '첨부 파일',
                href: attachmentUrl.signedUrl,
              }
            : null;
        }),
    ),
  ]);
  return Response.json({
    inquiry: {
      ...data,
      evidenceUrl: signed?.signedUrl ?? null,
      attachments: attachments.filter(
        (attachment): attachment is NonNullable<typeof attachment> => attachment !== null,
      ),
      parentRelationshipVerifiedAt: identity?.parent_relationship_verified_at ?? null,
    },
  });
}
