import { NextRequest } from 'next/server';
import {
  isInquiryInformationRequestType,
  inquiryResolutionLabels,
  isInquiryResolutionCode,
  isResolutionAllowedForInquiryType,
} from '@/lib/concierge/inquiries';
import { decrypt } from '@/lib/encryption/decrypt';
import { sendInquiryResultEmail } from '@/lib/notifications/inquiryResultEmail';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

type RouteContext = { params: Promise<{ inquiryId: string }> };

export async function GET(_: NextRequest, context: RouteContext) {
  const currentStigma = await getCurrentStigma();

  if (!currentStigma) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  if (currentStigma.role !== 'admin') {
    return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const { inquiryId } = await context.params;
  const supabaseAdmin = getSupabaseAdmin();
  const { data: inquiry, error } = await supabaseAdmin
    .from('inquiries')
    .select(
      'id, requester_stigma_id, inquiry_type, inquiry_subtype, status, title, content, created_at, closed_at, resolution_code, resolution_summary, information_request_type, information_requested_at, information_due_at, payment_control_requested_at, payment_control_selected_at, pg_cancellation_unavailable_at, manual_refund_ready_at, manual_refund_completed_at, inquiry_orders(payment_id), inquiry_bug_details(*), inquiry_payment_details(*), inquiry_messages(id, sender_type, sender_stigma_id, message_type, message, created_at), inquiry_attachments(id, attachment_type, storage_path, storage_bucket, mime_type, submitted_at, deleted_at)',
    )
    .eq('id', inquiryId)
    .maybeSingle();

  if (error || !inquiry) {
    return Response.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 });
  }

  const { data: requester, error: requesterError } = await supabaseAdmin
    .from('stigmas')
    .select('user_name')
    .eq('id', inquiry.requester_stigma_id)
    .maybeSingle();
  if (requesterError || !requester?.user_name) {
    return Response.json({ error: '문의자 활동명을 불러오지 못했습니다.' }, { status: 500 });
  }
  let requesterActivityName: string;
  try {
    requesterActivityName = decrypt(requester.user_name);
  } catch {
    return Response.json({ error: '문의자 활동명을 확인하지 못했습니다.' }, { status: 500 });
  }

  const evidence = inquiry.inquiry_attachments.find(
    (item) => !item.deleted_at && ['bug_evidence', 'payment_evidence'].includes(item.attachment_type),
  );
  const { data: signedEvidence } = evidence
    ? await supabaseAdmin.storage.from(evidence.storage_bucket).createSignedUrl(evidence.storage_path, 600)
    : { data: null };

  let parent = null;
  if (inquiry.inquiry_type === 'minor_purchase_cancellation') {
    const { data: requester } = await supabaseAdmin
      .from('stigmas')
      .select('user_id')
      .eq('id', inquiry.requester_stigma_id)
      .maybeSingle();
    const { data: identity } = requester
      ? await supabaseAdmin
          .from('chorogons')
          .select(
            'father_name, father_birth_date, mother_name, mother_birth_date, parent_relationship_document_url, parent_relationship_document_bucket, parent_relationship_verified_at',
          )
          .eq('user_id', requester.user_id)
          .maybeSingle()
      : { data: null };
    const decode = (value: string | null) => {
      if (!value) return '';
      try {
        return decrypt(value);
      } catch {
        return value;
      }
    };
    const activeAttachment = inquiry.inquiry_attachments.find(
      (item) => !item.deleted_at && item.attachment_type === 'family_relation_certificate',
    );
    const attachmentPath = activeAttachment?.storage_path;
    const documentPath = attachmentPath ?? identity?.parent_relationship_document_url ?? null;
    let certificateUrl: string | null = null;
    if (documentPath) {
      for (const bucket of activeAttachment?.storage_bucket
        ? [activeAttachment.storage_bucket]
        : identity?.parent_relationship_document_bucket
          ? [identity.parent_relationship_document_bucket]
          : ['business-license', 'family-relation-certificates']) {
        const { data: signed } = await supabaseAdmin.storage.from(bucket).createSignedUrl(documentPath, 600);
        if (signed?.signedUrl) {
          certificateUrl = signed.signedUrl;
          break;
        }
      }
    }
    parent = identity
      ? {
          fatherName: decode(identity.father_name),
          fatherBirthDate: decode(identity.father_birth_date),
          motherName: decode(identity.mother_name),
          motherBirthDate: decode(identity.mother_birth_date),
          verifiedAt: identity.parent_relationship_verified_at,
          certificateUrl,
        }
      : null;
  }
  const { data: adjustments } = await supabaseAdmin
    .from('creator_settlement_adjustments')
    .select('remaining_amount')
    .eq('inquiry_id', inquiryId);
  const { data: refundAccount } = await supabaseAdmin
    .from('inquiry_refund_accounts')
    .select('id, bank_code, account_holder_type')
    .eq('inquiry_id', inquiryId)
    .maybeSingle();
  return Response.json({
    inquiry: { ...inquiry, requesterActivityName, evidenceUrl: signedEvidence?.signedUrl ?? null },
    parent,
    manualRefund: {
      hasAccount: Boolean(refundAccount),
      account: refundAccount,
      remainingAdjustmentAmount: (adjustments ?? []).reduce((sum, item) => sum + Number(item.remaining_amount), 0),
    },
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const currentStigma = await getCurrentStigma();

  if (!currentStigma) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  if (currentStigma.role !== 'admin') {
    return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const status = body?.status;
  const resolutionCode = body?.resolutionCode;
  const resolutionSummary = typeof body?.resolutionSummary === 'string' ? body.resolutionSummary.trim() : '';
  const informationRequestType = body?.informationRequestType;
  const informationRequestMessage =
    typeof body?.informationRequestMessage === 'string' ? body.informationRequestMessage.trim() : '';

  if (status !== 'received' && status !== 'reviewing' && status !== 'info_requested' && status !== 'closed') {
    return Response.json({ error: '올바르지 않은 문의 상태입니다.' }, { status: 400 });
  }

  if (status === 'closed' && (!isInquiryResolutionCode(resolutionCode) || !resolutionSummary)) {
    return Response.json({ error: '종결 결과와 안내 내용을 입력해 주세요.' }, { status: 400 });
  }

  if (
    status === 'info_requested' &&
    (!isInquiryInformationRequestType(informationRequestType) || !informationRequestMessage)
  ) {
    return Response.json({ error: '요청할 추가 정보의 종류와 내용을 입력해 주세요.' }, { status: 400 });
  }

  const { inquiryId } = await context.params;
  const supabaseAdmin = getSupabaseAdmin();
  const { data: existingInquiry, error: existingError } = await supabaseAdmin
    .from('inquiries')
    .select('requester_stigma_id, inquiry_type, status, pg_cancellation_unavailable_at')
    .eq('id', inquiryId)
    .maybeSingle();

  if (existingError || !existingInquiry) {
    return Response.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 });
  }

  if (existingInquiry.status === 'closed') {
    return Response.json({ error: '종결된 문의는 상태를 변경할 수 없습니다.' }, { status: 400 });
  }

  const allowedNextStatuses: Record<string, string[]> = {
    received: ['reviewing', 'info_requested', 'closed'],
    reviewing: ['info_requested', 'closed'],
    info_requested: ['reviewing', 'closed'],
  };
  const isLegacyInformationRequestRepair =
    existingInquiry.status === 'info_requested' && status === 'info_requested' && Boolean(informationRequestMessage);
  if (!isLegacyInformationRequestRepair && !allowedNextStatuses[existingInquiry.status]?.includes(status)) {
    return Response.json({ error: '현재 상태에서 선택한 상태로 변경할 수 없습니다.' }, { status: 400 });
  }

  if (
    status === 'info_requested' &&
    informationRequestType === 'family_relation_certificate' &&
    existingInquiry.inquiry_type !== 'minor_purchase_cancellation'
  ) {
    return Response.json(
      { error: '가족관계증명서는 미성년자 결제 청약취소 문의에서만 요청할 수 있습니다.' },
      { status: 400 },
    );
  }
  if (
    status === 'info_requested' &&
    informationRequestType === 'refund_account' &&
    !existingInquiry.pg_cancellation_unavailable_at
  ) {
    return Response.json(
      { error: '원결제수단 취소가 불가능한 문의에서만 반환 계좌를 요청할 수 있습니다.' },
      { status: 400 },
    );
  }
  if (
    status === 'info_requested' &&
    informationRequestType === 'evidence' &&
    !['bug_report', 'payment_refund_error'].includes(existingInquiry.inquiry_type)
  ) {
    return Response.json({ error: '이 문의 유형에는 증빙 파일을 요청할 수 없습니다.' }, { status: 400 });
  }

  if (
    status === 'closed' &&
    !isResolutionAllowedForInquiryType(existingInquiry.inquiry_type, resolutionCode as never)
  ) {
    return Response.json({ error: '해당 문의 유형에 사용할 수 없는 종결 결과입니다.' }, { status: 400 });
  }

  const updateValues =
    status === 'closed'
      ? {
          status,
          closed_at: new Date().toISOString(),
          resolution_code: resolutionCode,
          resolution_summary: resolutionSummary,
          resolved_by_stigma_id: currentStigma.stigmaId,
          information_request_type: null,
          information_requested_at: null,
          information_due_at: null,
        }
      : {
          status,
          closed_at: null,
          resolution_code: null,
          resolution_summary: null,
          resolved_by_stigma_id: null,
          information_request_type: status === 'info_requested' ? informationRequestType : null,
          information_requested_at: status === 'info_requested' ? new Date().toISOString() : null,
          information_due_at:
            status === 'info_requested' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
        };

  const { error: updateError } = await supabaseAdmin.from('inquiries').update(updateValues).eq('id', inquiryId);

  if (updateError) {
    return Response.json({ error: '문의 상태를 변경하지 못했습니다.' }, { status: 500 });
  }
  if (status === 'info_requested') {
    const { error: messageError } = await supabaseAdmin.from('inquiry_messages').insert({
      inquiry_id: inquiryId,
      sender_type: 'admin',
      sender_stigma_id: currentStigma.stigmaId,
      message_type: 'information_request',
      message: informationRequestMessage,
    });
    if (messageError) {
      await supabaseAdmin
        .from('inquiries')
        .update({
          status: existingInquiry.status,
          information_request_type: null,
          information_requested_at: null,
          information_due_at: null,
        })
        .eq('id', inquiryId);
      return Response.json({ error: '추가 정보 요청 내용을 저장하지 못했습니다.' }, { status: 500 });
    }
  }
  if (status === 'closed') {
    const purgeAfter = new Date();
    purgeAfter.setFullYear(purgeAfter.getFullYear() + 5);
    await supabaseAdmin
      .from('inquiry_attachments')
      .update({ purge_after: purgeAfter.toISOString() })
      .eq('inquiry_id', inquiryId)
      .is('deleted_at', null);
    const { data: requester } = await supabaseAdmin
      .from('stigmas')
      .select('email')
      .eq('id', existingInquiry.requester_stigma_id)
      .maybeSingle();
    if (requester?.email && isInquiryResolutionCode(resolutionCode))
      await sendInquiryResultEmail({
        email: requester.email,
        result: inquiryResolutionLabels[resolutionCode],
        reason: resolutionSummary,
      }).catch(() => null);
  }

  await supabaseAdmin.from('inquiry_status').insert({
    inquiry_id: inquiryId,
    previous_status: existingInquiry.status,
    next_status: status,
    changed_by_stigma_id: currentStigma.stigmaId,
    reason: status === 'info_requested' ? informationRequestMessage : resolutionSummary || null,
  });

  return Response.json({ ok: true });
}
