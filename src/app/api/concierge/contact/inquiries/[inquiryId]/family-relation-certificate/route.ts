import { NextRequest } from 'next/server';
import { encrypt } from '@/lib/encryption/encrypt';
import { extractVerifiedIdentity, getPortOneIdentityVerification } from '@/lib/identity/portone';
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
  const identityVerificationId = formData.get('identityVerificationId');

  if (identityVerificationId && typeof identityVerificationId !== 'string') {
    return Response.json({ error: '잘못된 본인인증 정보입니다.' }, { status: 400 });
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
    (inquiry.information_request_type !== 'family_relation_certificate' &&
      inquiry.information_request_type !== 'guardian_identity_and_family_relation_certificate' &&
      inquiry.information_request_type !== 'guardian_identity_verification')
  ) {
    return Response.json({ error: '현재 해당 요청을 처리할 수 있는 문의가 아닙니다.' }, { status: 400 });
  }

  const isCertificateRequired =
    inquiry.information_request_type === 'family_relation_certificate' ||
    inquiry.information_request_type === 'guardian_identity_and_family_relation_certificate';

  const isIdentityRequired =
    inquiry.information_request_type === 'guardian_identity_and_family_relation_certificate' ||
    inquiry.information_request_type === 'guardian_identity_verification';

  if (isIdentityRequired && !identityVerificationId) {
    return Response.json({ error: '법정대리인 본인인증을 먼저 완료해 주세요.' }, { status: 400 });
  }

  if (isCertificateRequired) {
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: '가족관계증명서 PDF를 선택해 주세요.' }, { status: 400 });
    }

    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      return Response.json({ error: '가족관계증명서는 PDF 파일만 제출할 수 있습니다.' }, { status: 400 });
    }

    if (file.size > maxFileSize) {
      return Response.json({ error: '가족관계증명서 PDF는 10MB 이하만 제출할 수 있습니다.' }, { status: 400 });
    }
  }

  let verifiedIdentity: ReturnType<typeof extractVerifiedIdentity> = null;
  if (isIdentityRequired && identityVerificationId) {
    const portOneVerification = await getPortOneIdentityVerification(identityVerificationId as string);
    verifiedIdentity = extractVerifiedIdentity(identityVerificationId as string, portOneVerification);
    
    if (!verifiedIdentity) {
      return Response.json({ error: '법정대리인 본인인증 결과를 확인할 수 없습니다.' }, { status: 400 });
    }
  }

  if (isCertificateRequired && file instanceof File) {
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
  }

  if (verifiedIdentity) {
    const updatePayload: Record<string, string | null> = {
      parent_relationship_verified_at: new Date().toISOString(),
    };
    if (verifiedIdentity.gender === 'MALE' || verifiedIdentity.gender === 'M') {
      updatePayload.father_name = encrypt(verifiedIdentity.name);
      updatePayload.father_birth_date = encrypt(verifiedIdentity.birthDate);
    } else {
      updatePayload.mother_name = encrypt(verifiedIdentity.name);
      updatePayload.mother_birth_date = encrypt(verifiedIdentity.birthDate);
    }
    const { error: identityUpdateError } = await supabaseAdmin
      .from('chorogons')
      .update(updatePayload)
      .eq('user_id', currentStigma.stigmaId);

    if (identityUpdateError) {
      console.error('identityUpdateError:', identityUpdateError);
      return Response.json({ error: '법정대리인 인증 정보를 저장하지 못했습니다.' }, { status: 500 });
    }
  }

  await supabaseAdmin.from('inquiry_messages').insert({
    inquiry_id: inquiryId,
    sender_type: 'requester',
    sender_stigma_id: currentStigma.stigmaId,
    message_type: 'information_response',
    message: 
      inquiry.information_request_type === 'guardian_identity_verification' ? '법정대리인 본인인증을 완료했습니다.' :
      inquiry.information_request_type === 'guardian_identity_and_family_relation_certificate' ? '법정대리인 본인인증 및 가족관계증명서 PDF를 제출했습니다.' : 
      '가족관계증명서 PDF를 제출했습니다.',
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
    reason: 
      inquiry.information_request_type === 'guardian_identity_verification' ? '법정대리인 본인인증 완료' :
      inquiry.information_request_type === 'guardian_identity_and_family_relation_certificate' ? '법정대리인 본인인증 및 가족관계증명서 PDF 제출' : 
      '가족관계증명서 PDF 제출',
  });

  return Response.json({ ok: true });
}
