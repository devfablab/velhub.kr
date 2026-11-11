import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import {
  callCommunityChatWorker,
  COMMUNITY_CHAT_MIN_MEMBERS,
  countCommunityChatMembers,
  createCommunityChatToken,
  getCommunityChatContext,
  getCommunityChatWorkerUrl,
} from '@/lib/service/community/communityChat';

type RouteContext = { params: Promise<{ siteName: string }> };

function getConnection(siteId: string, stigmaId: string) {
  const workerUrl = getCommunityChatWorkerUrl().replace(/^http/, 'ws');
  const token = createCommunityChatToken(siteId, stigmaId);

  return `${workerUrl}/rooms/${siteId}/ws?token=${encodeURIComponent(token)}`;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { siteName } = await context.params;
    const chat = await getCommunityChatContext(siteName);

    if (!chat || !chat.canUse || !chat.stigmaId) {
      return NextResponse.json({ status: 'hidden' });
    }

    if (chat.isOpen) {
      return NextResponse.json({
        status: 'open',
        stigmaId: chat.stigmaId,
        canDelete: chat.canDelete,
        connectionUrl: getConnection(chat.siteId, chat.stigmaId),
      });
    }

    if (!chat.isOwner) {
      return NextResponse.json({ status: 'hidden' });
    }

    const memberCount = await countCommunityChatMembers(chat.siteId);

    return NextResponse.json({ status: memberCount >= COMMUNITY_CHAT_MIN_MEMBERS ? 'openable' : 'hidden' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '채팅 정보를 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { siteName } = await context.params;
    const chat = await getCommunityChatContext(siteName);

    if (!chat || !chat.isOwner || !chat.stigmaId) {
      return NextResponse.json({ error: '채팅방은 운영자만 개설할 수 있습니다.' }, { status: 403 });
    }

    if (!chat.isOpen) {
      const memberCount = await countCommunityChatMembers(chat.siteId);

      if (memberCount < COMMUNITY_CHAT_MIN_MEMBERS) {
        return NextResponse.json(
          {
            error: `가입 멤버가 ${COMMUNITY_CHAT_MIN_MEMBERS.toLocaleString()}명 이상이어야 채팅방을 개설할 수 있습니다.`,
          },
          { status: 400 },
        );
      }

      await callCommunityChatWorker(`/rooms/${chat.siteId}/init`, { method: 'POST' });

      const insertResult = await getSupabaseAdmin()
        .from('community_chat_rooms')
        .upsert({ site_id: chat.siteId, opened_by: chat.stigmaId }, { onConflict: 'site_id', ignoreDuplicates: true });

      if (insertResult.error) {
        throw new Error('채팅방을 개설하지 못했습니다.');
      }
    }

    return NextResponse.json({
      status: 'open',
      stigmaId: chat.stigmaId,
      canDelete: chat.canDelete,
      connectionUrl: getConnection(chat.siteId, chat.stigmaId),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '채팅방을 개설하지 못했습니다.' },
      { status: 500 },
    );
  }
}
