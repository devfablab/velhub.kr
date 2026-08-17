import { NextRequest } from 'next/server';
import { sendInquiryResultEmail } from '@/lib/notifications/inquiryResultEmail';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
    return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data: expiredInquiries } = await db
    .from('inquiries')
    .select('id, requester_stigma_id')
    .eq('status', 'info_requested')
    .lte('information_due_at', now);
  for (const inquiry of expiredInquiries ?? []) {
    const summary = '요청드린 추가 정보가 제출 기한 내에 접수되지 않아 문의를 종결했습니다.';
    const { data: closedInquiry } = await db
      .from('inquiries')
      .update({
        status: 'closed',
        resolution_code: 'additional_information_not_submitted',
        resolution_summary: summary,
        closed_at: now,
        information_request_type: null,
        information_requested_at: null,
        information_due_at: null,
      })
      .eq('id', inquiry.id)
      .eq('status', 'info_requested')
      .select('id')
      .maybeSingle();
    if (!closedInquiry) continue;
    const purgeAfter = new Date();
    purgeAfter.setFullYear(purgeAfter.getFullYear() + 5);
    await db
      .from('inquiry_attachments')
      .update({ purge_after: purgeAfter.toISOString() })
      .eq('inquiry_id', inquiry.id)
      .is('deleted_at', null);
    await db.from('inquiry_status').insert({
      inquiry_id: inquiry.id,
      previous_status: 'info_requested',
      next_status: 'closed',
      reason: summary,
    });
    const { data: requester } = await db
      .from('stigmas')
      .select('email')
      .eq('id', inquiry.requester_stigma_id)
      .maybeSingle();
    if (requester?.email)
      await sendInquiryResultEmail({
        email: requester.email,
        result: '추가 정보 미제출',
        reason: summary,
      }).catch(() => null);
  }
  const { data: attachments, error } = await db
    .from('inquiry_attachments')
    .select('id, storage_path, storage_bucket')
    .lte('purge_after', now)
    .is('deleted_at', null);
  if (error) return Response.json({ error: '보관기간 만료 파일을 확인하지 못했습니다.' }, { status: 500 });
  const deletableAttachments: NonNullable<typeof attachments> = [];
  for (const attachment of attachments ?? []) {
    const { data: laterReference } = await db
      .from('inquiry_attachments')
      .select('id')
      .eq('storage_path', attachment.storage_path)
      .is('deleted_at', null)
      .neq('id', attachment.id)
      .or(`purge_after.is.null,purge_after.gt.${now}`)
      .limit(1)
      .maybeSingle();
    if (!laterReference) deletableAttachments.push(attachment);
  }
  const paths = deletableAttachments.map((item) => item.storage_path);
  if (paths.length) {
    for (const bucket of ['family-relation-certificates', 'business-license', 'inquiry-attachments']) {
      const bucketPaths = deletableAttachments
        .filter((item) => item.storage_bucket === bucket)
        .map((item) => item.storage_path);
      if (!bucketPaths.length) continue;
      const { error: removeError } = await db.storage.from(bucket).remove(bucketPaths);
      if (removeError) return Response.json({ error: '보관기간 만료 파일을 삭제하지 못했습니다.' }, { status: 500 });
    }
    await db
      .from('inquiry_attachments')
      .update({ deleted_at: now })
      .in(
        'id',
        deletableAttachments.map((item) => item.id),
      );
    await db
      .from('chorogons')
      .update({ parent_relationship_document_url: null, parent_relationship_document_bucket: null })
      .in('parent_relationship_document_url', paths);
  }
  const { data: refundAccounts } = await db
    .from('inquiry_refund_accounts')
    .select('id')
    .lte('purge_after', now)
    .is('deleted_at', null);
  if (refundAccounts?.length)
    await db
      .from('inquiry_refund_accounts')
      .delete()
      .in(
        'id',
        refundAccounts.map((item) => item.id),
      );
  return Response.json({
    ok: true,
    closedInquiries: expiredInquiries?.length ?? 0,
    deletedCertificates: paths.length,
    deletedRefundAccounts: refundAccounts?.length ?? 0,
  });
}

export const GET = POST;
