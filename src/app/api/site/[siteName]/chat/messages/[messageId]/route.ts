import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import {
  callCommunityChatWorker,
  type CommunityChatMessage,
  getCommunityChatContext,
} from '@/lib/service/community/communityChat';

type RouteContext = { params: Promise<{ siteName: string; messageId: string }> };

async function getMessageAuthorId(siteId: string, messageId: string) {
  const workerResponse = await callCommunityChatWorker(`/rooms/${siteId}/messages/${messageId}`);
  const workerResult = (await workerResponse.json()) as { message?: CommunityChatMessage | null };

  if (workerResult.message) {
    return { isFound: true, stigmaId: workerResult.message.stigmaId };
  }

  const archiveResult = await getSupabaseAdmin()
    .from('community_chat_messages')
    .select('stigma_id')
    .eq('site_id', siteId)
    .eq('id', messageId)
    .maybeSingle();

  if (archiveResult.error) {
    throw new Error('메시지를 찾지 못했습니다.');
  }

  return { isFound: Boolean(archiveResult.data), stigmaId: (archiveResult.data?.stigma_id as string | null) ?? null };
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { siteName, messageId } = await context.params;
    const chat = await getCommunityChatContext(siteName);

    if (!chat || !chat.isOpen || !chat.canUse || !chat.stigmaId) {
      return NextResponse.json({ error: '채팅방을 사용할 수 없습니다.' }, { status: 403 });
    }

    if (!/^[0-9a-f-]{36}$/i.test(messageId)) {
      return NextResponse.json({ error: '메시지를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!chat.canDelete) {
      const author = await getMessageAuthorId(chat.siteId, messageId);

      if (!author.isFound) {
        return NextResponse.json({ error: '메시지를 찾을 수 없습니다.' }, { status: 404 });
      }

      if (author.stigmaId !== chat.stigmaId) {
        return NextResponse.json({ error: '본인이 쓴 메시지만 지울 수 있습니다.' }, { status: 403 });
      }
    }

    const [, archiveResult] = await Promise.all([
      callCommunityChatWorker(`/rooms/${chat.siteId}/messages/${messageId}`, { method: 'DELETE' }),
      getSupabaseAdmin().from('community_chat_messages').delete().eq('site_id', chat.siteId).eq('id', messageId),
    ]);

    if (archiveResult.error) {
      throw new Error('메시지를 지우지 못했습니다.');
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '메시지를 지우지 못했습니다.' },
      { status: 500 },
    );
  }
}
