import { NextRequest } from 'next/server';
import { getChorogonBirthDate } from '@/lib/identity/chorogon';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

type Mode = 'blocked_until_adult' | 'guardian_auth_required';

function isMode(value: unknown): value is Mode {
  return value === 'blocked_until_adult' || value === 'guardian_auth_required';
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ inquiryId: string }> }) {
  const current = await getCurrentStigma();
  if (!current) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { mode?: unknown } | null;
  if (!isMode(body?.mode)) return Response.json({ error: '향후 결제 방침을 선택해 주세요.' }, { status: 400 });
  const { inquiryId } = await params;
  const db = getSupabaseAdmin();
  const { data: inquiry } = await db
    .from('inquiries')
    .select('inquiry_type, status, information_request_type')
    .eq('id', inquiryId)
    .eq('requester_stigma_id', current.stigmaId)
    .maybeSingle();
  if (
    !inquiry ||
    inquiry.inquiry_type !== 'minor_purchase_cancellation' ||
    inquiry.status !== 'info_requested' ||
    inquiry.information_request_type !== 'payment_control'
  )
    return Response.json({ error: '현재 결제 방침을 선택할 수 있는 문의가 아닙니다.' }, { status: 400 });
  const { data: identity } = await db
    .from('chorogons')
    .select('id, birth_date, birth_date_dummy, parent_relationship_verified_at')
    .eq('user_id', current.stigmaId)
    .maybeSingle();
  if (!identity?.parent_relationship_verified_at)
    return Response.json({ error: '부 / 모 관계 확인이 완료된 뒤에 선택할 수 있습니다.' }, { status: 400 });
  const birthDate = getChorogonBirthDate(identity);
  const digits = String(birthDate ?? '').replace(/\D/g, '');
  if (digits.length !== 8) return Response.json({ error: '생년월일을 확인할 수 없습니다.' }, { status: 400 });
  const effectiveUntil = `${Number(digits.slice(0, 4)) + 19}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  const { error } = await db.from('payment_minor_controls').upsert(
    {
      chorogon_id: identity.id,
      mode: body.mode,
      effective_until: effectiveUntil,
      source_inquiry_id: inquiryId,
      set_by_stigma_id: current.stigmaId,
    },
    { onConflict: 'chorogon_id' },
  );
  if (error) return Response.json({ error: '향후 결제 방침을 저장하지 못했습니다.' }, { status: 500 });
  await db
    .from('inquiries')
    .update({
      status: 'reviewing',
      information_request_type: null,
      information_requested_at: null,
      information_due_at: null,
      payment_control_selected_at: new Date().toISOString(),
    })
    .eq('id', inquiryId);
  await db.from('inquiry_messages').insert({
    inquiry_id: inquiryId,
    sender_type: 'requester',
    sender_stigma_id: current.stigmaId,
    message_type: 'information_response',
    message:
      body.mode === 'blocked_until_adult'
        ? '만 19세가 될 때까지 결제 / 구매 / 후원을 허용하지 않는 방침을 선택했습니다.'
        : '이후 결제마다 법정대리인 본인인증을 받는 방침을 선택했습니다.',
  });
  await db.from('inquiry_status').insert({
    inquiry_id: inquiryId,
    previous_status: 'info_requested',
    next_status: 'reviewing',
    changed_by_stigma_id: current.stigmaId,
    reason: '향후 결제 방침 선택 완료',
  });
  return Response.json({ ok: true });
}
