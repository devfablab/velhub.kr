import { NextRequest } from 'next/server';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const current = await getCurrentStigma();
  if (!current) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { content?: unknown } | null;
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (!content) return Response.json({ error: '추가 내용을 입력해 주세요.' }, { status: 400 });

  const { proposalId } = await params;
  const db = getSupabaseAdmin();
  const proposalResult = await db
    .from('partnership_proposals')
    .select('id, response_channel')
    .eq('id', proposalId)
    .eq('proposer_stigma_id', current.stigmaId)
    .maybeSingle();
  if (proposalResult.error) return Response.json({ error: '제휴 제안을 확인하지 못했습니다.' }, { status: 500 });
  if (!proposalResult.data) return Response.json({ error: '제휴 제안을 찾을 수 없습니다.' }, { status: 404 });
  if (proposalResult.data.response_channel !== 'portal')
    return Response.json({ error: '이메일로 접수된 제안에는 추가 내용을 등록할 수 없습니다.' }, { status: 400 });

  const messageResult = await db
    .from('partnership_messages')
    .insert({ proposal_id: proposalId, author_type: 'customer', author_stigma_id: current.stigmaId, content })
    .select('id')
    .single();
  if (messageResult.error) return Response.json({ error: '추가 내용을 저장하지 못했습니다.' }, { status: 500 });
  const now = new Date().toISOString();
  const proposalUpdate = await db
    .from('partnership_proposals')
    .update({ last_message_author: 'customer', last_message_at: now, updated_at: now })
    .eq('id', proposalId)
    .eq('proposer_stigma_id', current.stigmaId);
  if (proposalUpdate.error) return Response.json({ error: '제휴 제안 상태를 변경하지 못했습니다.' }, { status: 500 });
  return Response.json({ id: messageResult.data.id }, { status: 201 });
}
