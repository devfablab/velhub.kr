import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import {
  type CommunityChatMessage,
  getCommunityChatRetentionDate,
  isCommunityChatWorkerRequest,
} from '@/lib/service/community/communityChat';

function isMessage(value: unknown): value is CommunityChatMessage {
  if (!value || typeof value !== 'object') return false;

  const message = value as Record<string, unknown>;

  return (
    typeof message.id === 'string' &&
    typeof message.authorName === 'string' &&
    typeof message.body === 'string' &&
    typeof message.createdAt === 'string'
  );
}

export async function POST(request: Request) {
  if (!isCommunityChatWorkerRequest(request)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 });
  }

  const requestBody = (await request.json().catch(() => null)) as { siteId?: unknown; messages?: unknown } | null;
  const siteId = typeof requestBody?.siteId === 'string' ? requestBody.siteId : '';
  const messages = Array.isArray(requestBody?.messages) ? requestBody.messages.filter(isMessage) : [];

  if (!siteId) {
    return NextResponse.json({ error: '사이트 정보가 없습니다.' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const retentionDate = getCommunityChatRetentionDate();
  const keptMessages = messages.filter((message) => message.createdAt >= retentionDate);

  if (keptMessages.length > 0) {
    const upsertResult = await supabaseAdmin.from('community_chat_messages').upsert(
      keptMessages.map((message) => ({
        id: message.id,
        site_id: siteId,
        stigma_id: message.stigmaId,
        author_name: message.authorName,
        author_avatar_url: message.authorAvatarUrl,
        body: message.body,
        created_at: message.createdAt,
      })),
      { onConflict: 'id' },
    );

    if (upsertResult.error) {
      return NextResponse.json({ error: '메시지를 옮기지 못했습니다.' }, { status: 500 });
    }
  }

  const cleanupResult = await supabaseAdmin
    .from('community_chat_messages')
    .delete()
    .eq('site_id', siteId)
    .lt('created_at', retentionDate);

  if (cleanupResult.error) {
    return NextResponse.json({ error: '오래된 메시지를 지우지 못했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, archived: keptMessages.length });
}
