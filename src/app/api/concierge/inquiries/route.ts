import { NextRequest } from 'next/server';
import { isInquiryType, inquiryTypes } from '@/lib/concierge/inquiries';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const currentStigma = await getCurrentStigma();

  if (!currentStigma) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  if (currentStigma.role !== 'admin') {
    return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const requestedType = request.nextUrl.searchParams.get('type');
  const type = requestedType && isInquiryType(requestedType) ? requestedType : null;

  if (requestedType && !type) {
    return Response.json({ error: '올바르지 않은 문의 유형입니다.' }, { status: 400 });
  }

  let query = getSupabaseAdmin()
    .from('inquiries')
    .select('id, requester_stigma_id, inquiry_type, status, title, created_at, closed_at, resolution_code')
    .order('created_at', { ascending: false });

  if (type) {
    query = query.eq('inquiry_type', type);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: '문의 내역을 불러오지 못했습니다.' }, { status: 500 });
  }

  return Response.json({ inquiryTypes, inquiries: data ?? [] });
}
