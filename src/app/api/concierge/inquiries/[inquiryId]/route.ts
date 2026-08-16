import { NextRequest } from 'next/server';
import { isInquiryResolutionCode, isResolutionAllowedForInquiryType } from '@/lib/concierge/inquiries';
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
      'id, requester_stigma_id, inquiry_type, status, title, content, created_at, closed_at, resolution_code, resolution_summary, inquiry_orders(payment_id), inquiry_messages(id, sender_type, sender_stigma_id, message, created_at), inquiry_attachments(id, attachment_type, storage_path, mime_type, submitted_at, deleted_at)',
    )
    .eq('id', inquiryId)
    .maybeSingle();

  if (error || !inquiry) {
    return Response.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 });
  }

  return Response.json({ inquiry });
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
    .select('inquiry_type, status')
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

  await supabaseAdmin.from('inquiry_status').insert({
    inquiry_id: inquiryId,
    previous_status: existingInquiry.status,
    next_status: status,
    changed_by_stigma_id: currentStigma.stigmaId,
    reason: resolutionSummary || null,
  });

  return Response.json({ ok: true });
}
