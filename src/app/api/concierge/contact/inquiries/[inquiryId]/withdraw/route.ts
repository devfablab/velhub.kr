import { sendInquiryResultEmail } from '@/lib/notifications/inquiryResultEmail';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(_: Request, { params }: { params: Promise<{ inquiryId: string }> }) {
  const current = await getCurrentStigma();
  if (!current) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const { inquiryId } = await params;
  const db = getSupabaseAdmin();
  const { data: inquiry } = await db
    .from('inquiries')
    .select('status')
    .eq('id', inquiryId)
    .eq('requester_stigma_id', current.stigmaId)
    .maybeSingle();
  if (!inquiry || inquiry.status === 'closed')
    return Response.json({ error: '철회할 수 있는 문의가 아닙니다.' }, { status: 400 });

  const now = new Date().toISOString();
  const summary = '요청에 따라 문의를 철회하고 종결했습니다.';
  const { error } = await db
    .from('inquiries')
    .update({
      status: 'closed',
      resolution_code: 'request_withdrawn',
      resolution_summary: summary,
      closed_at: now,
      information_request_type: null,
      information_requested_at: null,
      information_due_at: null,
    })
    .eq('id', inquiryId)
    .neq('status', 'closed');
  if (error) return Response.json({ error: '문의를 철회하지 못했습니다.' }, { status: 500 });
  const purgeAfter = new Date();
  purgeAfter.setFullYear(purgeAfter.getFullYear() + 5);
  await db
    .from('inquiry_attachments')
    .update({ purge_after: purgeAfter.toISOString() })
    .eq('inquiry_id', inquiryId)
    .is('deleted_at', null);
  await db.from('inquiry_status').insert({
    inquiry_id: inquiryId,
    previous_status: inquiry.status,
    next_status: 'closed',
    changed_by_stigma_id: current.stigmaId,
    reason: summary,
  });
  const { data: requester } = await db.from('stigmas').select('email').eq('id', current.stigmaId).maybeSingle();
  if (requester?.email)
    await sendInquiryResultEmail({ email: requester.email, result: '문의 철회', reason: summary }).catch(() => null);
  return Response.json({ ok: true });
}
