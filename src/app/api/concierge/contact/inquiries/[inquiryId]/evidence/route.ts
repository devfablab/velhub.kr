import { NextRequest } from 'next/server';
import { verifyConciergeTemporaryFile } from '@/lib/attachments/conciergeFiles.server';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/clients/supabase';

const bucket = 'inquiry-attachments';
const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: NextRequest, context: { params: Promise<{ inquiryId: string }> }) {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { inquiryId } = await context.params;
  const db = getSupabaseAdmin();
  const { data: inquiry, error: inquiryError } = await db
    .from('inquiries')
    .select('id, requester_stigma_id, inquiry_type, status, information_request_type')
    .eq('id', inquiryId)
    .maybeSingle();
  if (inquiryError || !inquiry || inquiry.requester_stigma_id !== currentStigma.stigmaId)
    return Response.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 });
  if (!['bug_report', 'payment_refund_error'].includes(inquiry.inquiry_type))
    return Response.json({ error: '이 문의에는 증빙 파일을 첨부할 수 없습니다.' }, { status: 400 });
  const isInitialEvidence = inquiry.status === 'received';
  const isRequestedEvidence = inquiry.status === 'info_requested' && inquiry.information_request_type === 'evidence';
  if (!isInitialEvidence && !isRequestedEvidence)
    return Response.json({ error: '현재 증빙 파일을 첨부할 수 있는 문의가 아닙니다.' }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { file?: unknown } | null;
  const file = body?.file as { fileName?: unknown; fileSize?: unknown; mimeType?: unknown; storagePath?: unknown } | null;
  if (!file || !allowedMimeTypes.has(String(file.mimeType)))
    return Response.json({ error: 'PDF, JPG, PNG 또는 WEBP 파일만 첨부할 수 있습니다.' }, { status: 400 });
  if (typeof file.fileSize !== 'number' || file.fileSize > 1024 * 1024) return Response.json({ error: '첨부 파일은 1MB 이하만 가능합니다.' }, { status: 400 });
  if (typeof file.storagePath !== 'string' || !file.storagePath.startsWith(`temp/concierge/${currentStigma.userId}/contact_evidence/`)) return Response.json({ error: '첨부 파일 경로가 올바르지 않습니다.' }, { status: 400 });
  const uploadError = await verifyConciergeTemporaryFile({
    bucket,
    file: file as { fileSize: number; mimeType: string; storagePath: string },
    prefix: `temp/concierge/${currentStigma.userId}/contact_evidence/`,
  });
  if (uploadError) return Response.json({ error: uploadError }, { status: 400 });
  const storagePath = file.storagePath;

  const attachmentType = inquiry.inquiry_type === 'bug_report' ? 'bug_evidence' : 'payment_evidence';
  const { data: previous } = await db
    .from('inquiry_attachments')
    .select('storage_path')
    .eq('inquiry_id', inquiryId)
    .eq('attachment_type', attachmentType)
    .maybeSingle();
  const { error: saveError } = await db.from('inquiry_attachments').upsert(
    {
      inquiry_id: inquiryId,
      attachment_type: attachmentType,
      storage_path: storagePath,
      storage_bucket: bucket,
      mime_type: String(file.mimeType),
      submitted_by_stigma_id: currentStigma.stigmaId,
      submitted_at: new Date().toISOString(),
      deleted_at: null,
    },
    { onConflict: 'inquiry_id,attachment_type' },
  );
  if (saveError) {
    return Response.json({ error: '증빙 파일 정보를 저장하지 못했습니다.' }, { status: 500 });
  }

  if (isRequestedEvidence) {
    const now = new Date().toISOString();
    await db.from('inquiry_messages').insert({
      inquiry_id: inquiryId,
      sender_type: 'requester',
      sender_stigma_id: currentStigma.stigmaId,
      message_type: 'information_response',
      message: '요청받은 증빙 파일을 제출했습니다.',
    });
    await db
      .from('inquiries')
      .update({
        status: 'reviewing',
        information_request_type: null,
        information_requested_at: null,
        information_due_at: null,
      })
      .eq('id', inquiryId);
    await db.from('inquiry_status').insert({
      inquiry_id: inquiryId,
      previous_status: 'info_requested',
      next_status: 'reviewing',
      changed_by_stigma_id: currentStigma.stigmaId,
      reason: '증빙 파일 제출',
      created_at: now,
    });
  }

  return Response.json({ uploaded: true });
}
