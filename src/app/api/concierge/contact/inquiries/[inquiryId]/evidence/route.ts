import { NextRequest } from 'next/server';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

const bucket = 'inquiry-attachments';
const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: NextRequest, context: { params: Promise<{ inquiryId: string }> }) {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { inquiryId } = await context.params;
  const db = getSupabaseAdmin();
  const { data: inquiry, error: inquiryError } = await db
    .from('inquiries')
    .select('id, requester_stigma_id, inquiry_type')
    .eq('id', inquiryId)
    .maybeSingle();
  if (inquiryError || !inquiry || inquiry.requester_stigma_id !== currentStigma.stigmaId)
    return Response.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 });
  if (!['bug_report', 'payment_refund_error'].includes(inquiry.inquiry_type))
    return Response.json({ error: '이 문의에는 증빙 파일을 첨부할 수 없습니다.' }, { status: 400 });

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File) || !allowedMimeTypes.has(file.type))
    return Response.json({ error: 'PDF, JPG, PNG 또는 WEBP 파일만 첨부할 수 있습니다.' }, { status: 400 });
  if (file.size > 1024 * 1024) return Response.json({ error: '첨부 파일은 1MB 이하만 가능합니다.' }, { status: 400 });

  const extension =
    file.name
      .split('.')
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, '') || 'file';
  const storagePath = `${currentStigma.stigmaId}/${inquiryId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await db.storage.from(bucket).upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) return Response.json({ error: '증빙 파일을 업로드하지 못했습니다.' }, { status: 500 });

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
      mime_type: file.type,
      submitted_by_stigma_id: currentStigma.stigmaId,
      submitted_at: new Date().toISOString(),
      deleted_at: null,
    },
    { onConflict: 'inquiry_id,attachment_type' },
  );
  if (saveError) {
    await db.storage.from(bucket).remove([storagePath]);
    return Response.json({ error: '증빙 파일 정보를 저장하지 못했습니다.' }, { status: 500 });
  }
  if (previous?.storage_path) await db.storage.from(bucket).remove([previous.storage_path]);

  return Response.json({ uploaded: true });
}
