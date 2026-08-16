import { NextRequest } from 'next/server';
import { encrypt } from '@/lib/encryption/encrypt';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
function birthDate(value: string) {
  return /^\d{8}$/.test(value);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ inquiryId: string }> }) {
  const admin = await getCurrentStigma();
  if (!admin) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (admin.role !== 'admin') return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  const { inquiryId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const fatherName = text(body?.fatherName);
  const fatherBirthDate = text(body?.fatherBirthDate);
  const motherName = text(body?.motherName);
  const motherBirthDate = text(body?.motherBirthDate);
  if (Boolean(fatherName) !== Boolean(fatherBirthDate) || Boolean(motherName) !== Boolean(motherBirthDate))
    return Response.json({ error: '부 또는 모의 성명과 생년월일은 함께 입력해 주세요.' }, { status: 400 });
  if (!fatherName && !motherName)
    return Response.json({ error: '확인된 부 또는 모 정보를 하나 이상 입력해 주세요.' }, { status: 400 });
  if ((fatherBirthDate && !birthDate(fatherBirthDate)) || (motherBirthDate && !birthDate(motherBirthDate)))
    return Response.json({ error: '생년월일은 YYYYMMDD 형식으로 입력해 주세요.' }, { status: 400 });
  const db = getSupabaseAdmin();
  const { data: inquiry } = await db
    .from('inquiries')
    .select('requester_stigma_id, inquiry_type')
    .eq('id', inquiryId)
    .maybeSingle();
  if (!inquiry || inquiry.inquiry_type !== 'minor_purchase_cancellation')
    return Response.json({ error: '청약취소 문의를 찾을 수 없습니다.' }, { status: 404 });
  const { data: attachment } = await db
    .from('inquiry_attachments')
    .select('storage_path, storage_bucket')
    .eq('inquiry_id', inquiryId)
    .eq('attachment_type', 'family_relation_certificate')
    .is('deleted_at', null)
    .maybeSingle();
  const { data: stigma } = await db
    .from('stigmas')
    .select('user_id')
    .eq('id', inquiry.requester_stigma_id)
    .maybeSingle();
  if (!stigma) return Response.json({ error: '계정 정보를 찾을 수 없습니다.' }, { status: 404 });
  const { data: existingIdentity } = await db
    .from('chorogons')
    .select('parent_relationship_document_url, parent_relationship_document_bucket')
    .eq('user_id', stigma.user_id)
    .maybeSingle();
  const documentPath = attachment?.storage_path ?? existingIdentity?.parent_relationship_document_url;
  if (!documentPath) return Response.json({ error: '확인할 가족관계증명서가 없습니다.' }, { status: 400 });
  if (!attachment) {
    await db.from('inquiry_attachments').insert({
      inquiry_id: inquiryId,
      attachment_type: 'family_relation_certificate',
      storage_path: documentPath,
      storage_bucket: existingIdentity?.parent_relationship_document_bucket ?? 'family-relation-certificates',
      mime_type: 'application/pdf',
      submitted_by_stigma_id: admin.stigmaId,
    });
  }
  const { error } = await db
    .from('chorogons')
    .update({
      father_name: fatherName ? encrypt(fatherName) : null,
      father_birth_date: fatherBirthDate ? encrypt(fatherBirthDate) : null,
      mother_name: motherName ? encrypt(motherName) : null,
      mother_birth_date: motherBirthDate ? encrypt(motherBirthDate) : null,
      parent_relationship_document_url: documentPath,
      parent_relationship_document_bucket:
        attachment?.storage_bucket ??
        existingIdentity?.parent_relationship_document_bucket ??
        'family-relation-certificates',
      parent_relationship_verified_at: new Date().toISOString(),
      parent_relationship_verified_by: admin.stigmaId,
    })
    .eq('user_id', stigma.user_id);
  if (error) return Response.json({ error: '부·모 확인 정보를 저장하지 못했습니다.' }, { status: 500 });
  return Response.json({ ok: true });
}
