import { NextRequest } from 'next/server';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest, { params }: { params: Promise<{ inquiryId: string }> }) {
  const current = await getCurrentStigma();
  if (!current) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { message?: unknown } | null;
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > 10000)
    return Response.json({ error: '추가 정보 답변을 입력해 주세요.' }, { status: 400 });

  const { inquiryId } = await params;
  const db = getSupabaseAdmin();
  const { data: inquiry, error: inquiryError } = await db
    .from('inquiries')
    .select('status, information_request_type')
    .eq('id', inquiryId)
    .eq('requester_stigma_id', current.stigmaId)
    .maybeSingle();
  if (inquiryError || !inquiry) return Response.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 });
  if (inquiry.status !== 'info_requested' || inquiry.information_request_type !== 'text_response')
    return Response.json({ error: '현재 답변을 제출할 수 있는 문의가 아닙니다.' }, { status: 400 });

  const { data: savedMessage, error: messageError } = await db
    .from('inquiry_messages')
    .insert({
      inquiry_id: inquiryId,
      sender_type: 'requester',
      sender_stigma_id: current.stigmaId,
      message_type: 'information_response',
      message,
    })
    .select('id')
    .single();
  if (messageError || !savedMessage)
    return Response.json({ error: '추가 정보 답변을 저장하지 못했습니다.' }, { status: 500 });

  const now = new Date().toISOString();
  const { error: updateError } = await db
    .from('inquiries')
    .update({
      status: 'reviewing',
      information_request_type: null,
      information_requested_at: null,
      information_due_at: null,
    })
    .eq('id', inquiryId)
    .eq('status', 'info_requested');
  if (updateError) {
    await db.from('inquiry_messages').delete().eq('id', savedMessage.id);
    return Response.json({ error: '문의 상태를 변경하지 못했습니다.' }, { status: 500 });
  }
  await db.from('inquiry_status').insert({
    inquiry_id: inquiryId,
    previous_status: 'info_requested',
    next_status: 'reviewing',
    changed_by_stigma_id: current.stigmaId,
    reason: '추가 정보 답변 제출',
    created_at: now,
  });
  return Response.json({ ok: true });
}
