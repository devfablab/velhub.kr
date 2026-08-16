import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
    return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data: attachments, error } = await db
    .from('inquiry_attachments')
    .select('id, storage_path, storage_bucket')
    .lte('purge_after', now)
    .is('deleted_at', null);
  if (error) return Response.json({ error: '보관기간 만료 파일을 확인하지 못했습니다.' }, { status: 500 });
  const paths = (attachments ?? []).map((item) => item.storage_path);
  if (paths.length) {
    for (const bucket of ['family-relation-certificates', 'business-license']) {
      const bucketPaths = (attachments ?? [])
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
        (attachments ?? []).map((item) => item.id),
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
    deletedCertificates: paths.length,
    deletedRefundAccounts: refundAccounts?.length ?? 0,
  });
}

export const GET = POST;
