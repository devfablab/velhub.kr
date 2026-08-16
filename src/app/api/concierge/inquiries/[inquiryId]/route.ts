import { NextRequest } from 'next/server';
import {
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
      'id, requester_stigma_id, inquiry_type, inquiry_subtype, status, title, content, created_at, closed_at, resolution_code, resolution_summary, payment_control_requested_at, payment_control_selected_at, pg_cancellation_unavailable_at, manual_refund_ready_at, manual_refund_completed_at, inquiry_orders(payment_id), inquiry_messages(id, sender_type, sender_stigma_id, message, created_at), inquiry_attachments(id, attachment_type, storage_path, storage_bucket, mime_type, submitted_at, deleted_at)',
    )
    .eq('id', inquiryId)
    .maybeSingle();

  if (error || !inquiry) {
    return Response.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 });
  }

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
            'father_name, father_birth_date, mother_name, mother_birth_date, parent_relationship_document_url, parent_relationship_verified_at',
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
    const activeAttachment = inquiry.inquiry_attachments.find((item) => !item.deleted_at);
    const attachmentPath = activeAttachment?.storage_path;
    const documentPath = attachmentPath ?? identity?.parent_relationship_document_url ?? null;
    let certificateUrl: string | null = null;
    if (documentPath) {
      for (const bucket of activeAttachment?.storage_bucket
        ? [activeAttachment.storage_bucket]
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
    inquiry,
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

  if (status !== 'received' && status !== 'reviewing' && status !== 'info_requested' && status !== 'closed') {
    return Response.json({ error: '올바르지 않은 문의 상태입니다.' }, { status: 400 });
  }

  if (status === 'closed' && (!isInquiryResolutionCode(resolutionCode) || !resolutionSummary)) {
    return Response.json({ error: '종결 결과와 안내 내용을 입력해 주세요.' }, { status: 400 });
  }

  const { inquiryId } = await context.params;
  const supabaseAdmin = getSupabaseAdmin();
  const { data: existingInquiry, error: existingError } = await supabaseAdmin
    .from('inquiries')
    .select('requester_stigma_id, inquiry_type, status')
    .eq('id', inquiryId)
    .maybeSingle();

  if (existingError || !existingInquiry) {
    return Response.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 });
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
        }
      : {
          status,
          closed_at: null,
          resolution_code: null,
          resolution_summary: null,
          resolved_by_stigma_id: null,
        };

  const { error: updateError } = await supabaseAdmin.from('inquiries').update(updateValues).eq('id', inquiryId);

  if (updateError) {
    return Response.json({ error: '문의 상태를 변경하지 못했습니다.' }, { status: 500 });
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
    reason: resolutionSummary || null,
  });

  return Response.json({ ok: true });
}
