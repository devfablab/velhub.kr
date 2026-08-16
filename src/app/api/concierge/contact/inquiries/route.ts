import { NextRequest } from 'next/server';
import { isInquiryType } from '@/lib/concierge/inquiries';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

function getText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET() {
  const currentStigma = await getCurrentStigma();

  if (!currentStigma) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('inquiries')
    .select('id, inquiry_type, status, title, created_at, closed_at, resolution_code')
    .eq('requester_stigma_id', currentStigma.stigmaId)
    .order('created_at', { ascending: false });

  if (error) {
    return Response.json({ error: '문의 내역을 불러오지 못했습니다.' }, { status: 500 });
  }

  return Response.json({ inquiries: data ?? [] });
}

export async function POST(request: NextRequest) {
  const currentStigma = await getCurrentStigma();

  if (!currentStigma) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const inquiryType = body?.inquiryType;
  const title = getText(body?.title);
  const content = getText(body?.content);
  const paymentId = getText(body?.paymentId);

  if (!isInquiryType(inquiryType)) {
    return Response.json({ error: '문의 유형을 선택해 주세요.' }, { status: 400 });
  }

  if (!title || title.length > 120 || !content || content.length > 10000) {
    return Response.json({ error: '제목 또는 문의 내용을 확인해 주세요.' }, { status: 400 });
  }

  if (inquiryType === 'minor_purchase_cancellation' && !paymentId) {
    return Response.json({ error: '청약취소를 요청할 결제를 선택해 주세요.' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  if (paymentId) {
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('id, buyer_user_id')
      .eq('id', paymentId)
      .maybeSingle();

    if (paymentError || !payment || payment.buyer_user_id !== currentStigma.stigmaId) {
      return Response.json({ error: '본인 계정의 결제만 선택할 수 있습니다.' }, { status: 400 });
    }
  }

  const { data: inquiry, error: inquiryError } = await supabaseAdmin
    .from('inquiries')
    .insert({
      requester_stigma_id: currentStigma.stigmaId,
      inquiry_type: inquiryType,
      title,
      content,
    })
    .select('id, inquiry_type, status, title, content, created_at')
    .single();

  if (inquiryError || !inquiry) {
    return Response.json({ error: '문의 접수에 실패했습니다.' }, { status: 500 });
  }

  if (paymentId) {
    const { error: orderError } = await supabaseAdmin.from('inquiry_orders').insert({
      inquiry_id: inquiry.id,
      payment_id: paymentId,
    });

    if (orderError) {
      await supabaseAdmin.from('inquiries').delete().eq('id', inquiry.id);
      return Response.json({ error: '문의에 결제를 연결하지 못했습니다.' }, { status: 500 });
    }
  }

  await supabaseAdmin.from('inquiry_status').insert({
    inquiry_id: inquiry.id,
    next_status: 'received',
    changed_by_stigma_id: currentStigma.stigmaId,
  });

  return Response.json({ inquiry }, { status: 201 });
}
