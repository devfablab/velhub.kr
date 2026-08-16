import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(_: Request, { params }: { params: Promise<{ inquiryId: string }> }) {
  const admin = await getCurrentStigma();
  if (!admin) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (admin.role !== 'admin') return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  const { inquiryId } = await params;
  const db = getSupabaseAdmin();
  const { data: inquiry } = await db
    .from('inquiries')
    .select('requester_stigma_id, inquiry_type, status')
    .eq('id', inquiryId)
    .maybeSingle();
  if (!inquiry || inquiry.inquiry_type !== 'minor_purchase_cancellation' || inquiry.status === 'closed')
    return Response.json({ error: '결제 방침을 요청할 수 없는 문의입니다.' }, { status: 400 });
  const { data: requester } = await db
    .from('stigmas')
    .select('user_id')
    .eq('id', inquiry.requester_stigma_id)
    .maybeSingle();
  const { data: identity } = requester
    ? await db
        .from('chorogons')
        .select('parent_relationship_verified_at')
        .eq('user_id', requester.user_id)
        .maybeSingle()
    : { data: null };
  if (!identity?.parent_relationship_verified_at)
    return Response.json({ error: '부·모 관계 확인을 먼저 완료해 주세요.' }, { status: 400 });
  const now = new Date().toISOString();
  const { error } = await db
    .from('inquiries')
    .update({ status: 'reviewing', payment_control_requested_at: now })
    .eq('id', inquiryId);
  if (error) return Response.json({ error: '결제 방침 선택 요청에 실패했습니다.' }, { status: 500 });
  await db
    .from('inquiry_messages')
    .insert({
      inquiry_id: inquiryId,
      sender_type: 'admin',
      sender_stigma_id: admin.stigmaId,
      message: '청약취소 처리 전 향후 결제·구매·후원 방침을 선택해 주세요.',
    });
  return Response.json({ ok: true });
}
