import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(_: Request, { params }: { params: Promise<{ inquiryId: string }> }) {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const { inquiryId } = await params;
  const { data, error } = await getSupabaseAdmin()
    .from('inquiries')
    .select(
      'id, inquiry_type, inquiry_subtype, status, title, content, created_at, closed_at, resolution_code, resolution_summary, payment_control_requested_at, payment_control_selected_at, pg_cancellation_unavailable_at, manual_refund_ready_at, manual_refund_completed_at, inquiry_messages(id, sender_type, message, created_at), inquiry_attachments(id, attachment_type, submitted_at)',
    )
    .eq('id', inquiryId)
    .eq('requester_stigma_id', currentStigma.stigmaId)
    .maybeSingle();
  if (error || !data) return Response.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 });
  return Response.json({ inquiry: data });
}
