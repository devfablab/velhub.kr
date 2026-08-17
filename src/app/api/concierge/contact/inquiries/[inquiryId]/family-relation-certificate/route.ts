import { NextRequest } from 'next/server';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

const bucket = 'family-relation-certificates';
const maxFileSize = 10 * 1024 * 1024;

export async function POST(request: NextRequest, { params }: { params: Promise<{ inquiryId: string }> }) {
  const currentStigma = await getCurrentStigma();

  if (!currentStigma) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { inquiryId } = await params;
  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: '가족관계증명서 PDF를 선택해 주세요.' }, { status: 400 });
  }

  if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
    return Response.json({ error: '가족관계증명서는 PDF 파일만 제출할 수 있습니다.' }, { status: 400 });
  }

  if (file.size > maxFileSize) {
    return Response.json({ error: '가족관계증명서 PDF는 10MB 이하만 제출할 수 있습니다.' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: inquiry, error: inquiryError } = await supabaseAdmin
    .from('inquiries')
    .select('id, inquiry_type, status, information_request_type')
    .eq('id', inquiryId)
    .eq('requester_stigma_id', currentStigma.stigmaId)
    .maybeSingle();

  if (inquiryError || !inquiry) {
    return Response.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 });
  }

  if (
    inquiry.inquiry_type !== 'minor_purchase_cancellation' ||
    inquiry.status !== 'info_requested' ||
    inquiry.information_request_type !== 'family_relation_certificate'
  ) {
    return Response.json({ error: '현재 가족관계증명서를 제출할 수 있는 문의가 아닙니다.' }, { status: 400 });
  }

  const storagePath = `${currentStigma.userId}/${inquiryId}/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await supabaseAdmin.storage.from(bucket).upload(storagePath, file, {
    contentType: 'application/pdf',
    upsert: false,
  });

  if (uploadError) {
    return Response.json({ error: '가족관계증명서 업로드에 실패했습니다.' }, { status: 500 });
  }

  const { data: existingAttachment } = await supabaseAdmin
    .from('inquiry_attachments')
    .select('id, storage_path')
    .eq('inquiry_id', inquiryId)
    .eq('attachment_type', 'family_relation_certificate')
    .maybeSingle();

  const { error: attachmentError } = await supabaseAdmin.from('inquiry_attachments').upsert(
    {
      inquiry_id: inquiryId,
      attachment_type: 'family_relation_certificate',
      storage_path: storagePath,
      storage_bucket: bucket,
      mime_type: 'application/pdf',
      submitted_by_stigma_id: currentStigma.stigmaId,
      submitted_at: new Date().toISOString(),
      deleted_at: null,
    },
    { onConflict: 'inquiry_id,attachment_type' },
  );

  if (attachmentError) {
    await supabaseAdmin.storage.from(bucket).remove([storagePath]);
    return Response.json({ error: '가족관계증명서 제출 기록을 저장하지 못했습니다.' }, { status: 500 });
  }
  if (existingAttachment?.storage_path) {
    const [{ data: identityReference }, { data: inquiryReference }] = await Promise.all([
      supabaseAdmin
        .from('chorogons')
        .select('id')
        .eq('parent_relationship_document_url', existingAttachment.storage_path)
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('inquiry_attachments')
        .select('id')
        .eq('storage_path', existingAttachment.storage_path)
        .neq('inquiry_id', inquiryId)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle(),
    ]);
    if (!identityReference && !inquiryReference)
      await supabaseAdmin.storage.from(bucket).remove([existingAttachment.storage_path]);
  }

  await supabaseAdmin.from('inquiry_messages').insert({
    inquiry_id: inquiryId,
    sender_type: 'requester',
    sender_stigma_id: currentStigma.stigmaId,
    message_type: 'information_response',
    message: '가족관계증명서 PDF를 제출했습니다.',
  });

  await supabaseAdmin
    .from('inquiries')
    .update({
      status: 'reviewing',
      information_request_type: null,
      information_requested_at: null,
      information_due_at: null,
    })
    .eq('id', inquiryId);
  await supabaseAdmin.from('inquiry_status').insert({
    inquiry_id: inquiryId,
    previous_status: 'info_requested',
    next_status: 'reviewing',
    changed_by_stigma_id: currentStigma.stigmaId,
    reason: '가족관계증명서 PDF 제출',
  });

  return Response.json({ ok: true });
}
