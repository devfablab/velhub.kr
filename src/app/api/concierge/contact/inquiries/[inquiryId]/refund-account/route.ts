import { NextRequest } from 'next/server';
import { decrypt } from '@/lib/encryption/decrypt';
import { encrypt } from '@/lib/encryption/encrypt';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest, { params }: { params: Promise<{ inquiryId: string }> }) {
  const current = await getCurrentStigma();
  if (!current) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const { inquiryId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const holderType = body?.holderType;
  const holderName = typeof body?.holderName === 'string' ? body.holderName.trim() : '';
  const bankCode = typeof body?.bankCode === 'string' ? body.bankCode.trim() : '';
  const accountNumber = typeof body?.accountNumber === 'string' ? body.accountNumber.replace(/\D/g, '') : '';
  if (
    !['account_holder', 'father', 'mother'].includes(String(holderType)) ||
    !holderName ||
    !bankCode ||
    !accountNumber
  )
    return Response.json({ error: '반환 계좌 정보를 모두 입력해 주세요.' }, { status: 400 });
  const db = getSupabaseAdmin();
  const { data: inquiry } = await db
    .from('inquiries')
    .select('status, information_request_type, pg_cancellation_unavailable_at')
    .eq('id', inquiryId)
    .eq('requester_stigma_id', current.stigmaId)
    .maybeSingle();
  if (
    !inquiry?.pg_cancellation_unavailable_at ||
    inquiry.status !== 'info_requested' ||
    inquiry.information_request_type !== 'refund_account'
  )
    return Response.json({ error: '예외 반환 계좌를 등록할 수 있는 문의가 아닙니다.' }, { status: 400 });
  const { data: identity } = await db
    .from('chorogons')
    .select('name, father_name, mother_name')
    .eq('user_id', current.stigmaId)
    .maybeSingle();
  const decode = (value: string | null) => {
    if (!value) return '';
    try {
      return decrypt(value);
    } catch {
      return value;
    }
  };
  const expected =
    holderType === 'father'
      ? decode(identity?.father_name)
      : holderType === 'mother'
        ? decode(identity?.mother_name)
        : decode(identity?.name);
  if (!expected || expected !== holderName)
    return Response.json({ error: '계정주 또는 확인된 부 / 모 명의의 계좌만 등록할 수 있습니다.' }, { status: 400 });
  const { error } = await db.from('inquiry_refund_accounts').upsert(
    {
      inquiry_id: inquiryId,
      account_holder_type: holderType,
      bank_code: bankCode,
      encrypted_account_holder_name: encrypt(holderName),
      encrypted_account_number: encrypt(accountNumber),
    },
    { onConflict: 'inquiry_id' },
  );
  if (error) return Response.json({ error: '반환 계좌를 저장하지 못했습니다.' }, { status: 500 });
  await db
    .from('inquiries')
    .update({
      status: 'reviewing',
      information_request_type: null,
      information_requested_at: null,
      information_due_at: null,
      manual_refund_ready_at: new Date().toISOString(),
    })
    .eq('id', inquiryId);
  await db.from('inquiry_messages').insert({
    inquiry_id: inquiryId,
    sender_type: 'requester',
    sender_stigma_id: current.stigmaId,
    message_type: 'information_response',
    message: '요청받은 반환 계좌 정보를 제출했습니다.',
  });
  await db.from('inquiry_status').insert({
    inquiry_id: inquiryId,
    previous_status: 'info_requested',
    next_status: 'reviewing',
    changed_by_stigma_id: current.stigmaId,
    reason: '반환 계좌 정보 제출',
  });
  return Response.json({ ok: true });
}
