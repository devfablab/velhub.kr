import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import {
  callCommunityChatWorker,
  COMMUNITY_CHAT_MAX_LENGTH,
  COMMUNITY_CHAT_PAGE_SIZE,
  type CommunityChatMessage,
  getCommunityChatAuthor,
  getCommunityChatContext,
  getCommunityChatRetentionDate,
} from '@/lib/service/community/communityChat';
import { hasChatWordingViolation } from '@/lib/wordingProfiler.server';

type RouteContext = { params: Promise<{ siteName: string }> };

type ArchivedMessageRow = {
  id: string;
  stigma_id: string | null;
  author_name: string;
  author_avatar_url: string | null;
  body: string;
  created_at: string;
};

function toTime(value: string) {
  return new Date(value).getTime();
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { siteName } = await context.params;
    const chat = await getCommunityChatContext(siteName);

    if (!chat || !chat.canUse || !chat.isOpen) {
      return NextResponse.json({ error: '채팅방을 사용할 수 없습니다.' }, { status: 403 });
    }

    const before = new URL(request.url).searchParams.get('before');
    const beforeTime = before ? toTime(before) : Number.NaN;
    const beforeParam = Number.isNaN(beforeTime)
      ? ''
      : `&before=${encodeURIComponent(new Date(beforeTime).toISOString())}`;

    const workerResponse = await callCommunityChatWorker(
      `/rooms/${chat.siteId}/messages?limit=${COMMUNITY_CHAT_PAGE_SIZE}${beforeParam}`,
    );
    const workerResult = (await workerResponse.json()) as { messages?: CommunityChatMessage[] };
    const workerMessages = workerResult.messages ?? [];
    let messages = [...workerMessages];

    if (messages.length < COMMUNITY_CHAT_PAGE_SIZE) {
      const oldestTime = messages.length > 0 ? messages[messages.length - 1].createdAt : null;
      const archiveBefore = oldestTime ?? (Number.isNaN(beforeTime) ? null : new Date(beforeTime).toISOString());
      let archiveQuery = getSupabaseAdmin()
        .from('community_chat_messages')
        .select('id, stigma_id, author_name, author_avatar_url, body, created_at')
        .eq('site_id', chat.siteId)
        .gte('created_at', getCommunityChatRetentionDate())
        .order('created_at', { ascending: false })
        .limit(COMMUNITY_CHAT_PAGE_SIZE - messages.length);

      if (archiveBefore) {
        archiveQuery = archiveQuery.lt('created_at', archiveBefore);
      }

      const archiveResult = await archiveQuery;

      if (archiveResult.error) {
        throw new Error('이전 메시지를 불러오지 못했습니다.');
      }

      const knownIds = new Set(messages.map((message) => message.id));
      const archivedMessages = ((archiveResult.data ?? []) as ArchivedMessageRow[])
        .filter((row) => !knownIds.has(row.id))
        .map((row) => ({
          id: row.id,
          stigmaId: row.stigma_id,
          authorName: row.author_name,
          authorAvatarUrl: row.author_avatar_url,
          body: row.body,
          createdAt: row.created_at,
        }));

      messages = [...messages, ...archivedMessages];
    }

    return NextResponse.json({
      messages: messages.sort((first, second) => toTime(first.createdAt) - toTime(second.createdAt)),
      hasMore: messages.length >= COMMUNITY_CHAT_PAGE_SIZE,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '메시지를 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { siteName } = await context.params;
    const chat = await getCommunityChatContext(siteName);

    if (!chat || !chat.canUse || !chat.isOpen || !chat.stigmaId) {
      return NextResponse.json({ error: '채팅방을 사용할 수 없습니다.' }, { status: 403 });
    }

    const requestBody = (await request.json().catch(() => null)) as { body?: unknown } | null;
    const body = typeof requestBody?.body === 'string' ? requestBody.body.trim() : '';

    if (!body) {
      return NextResponse.json({ error: '메시지를 입력해 주세요.' }, { status: 400 });
    }

    if ([...body].length > COMMUNITY_CHAT_MAX_LENGTH) {
      return NextResponse.json(
        { error: `메시지는 ${COMMUNITY_CHAT_MAX_LENGTH.toLocaleString()}자 이하로 입력해 주세요.` },
        { status: 400 },
      );
    }

    if (await hasChatWordingViolation(chat.siteId, body)) {
      return NextResponse.json({ status: 'hidden' });
    }

    const author = await getCommunityChatAuthor(chat.siteId, chat.stigmaId);
    const message: CommunityChatMessage = {
      id: crypto.randomUUID(),
      stigmaId: chat.stigmaId,
      authorName: author.name,
      authorAvatarUrl: author.avatarUrl,
      body,
      createdAt: new Date().toISOString(),
    };

    await callCommunityChatWorker(`/rooms/${chat.siteId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });

    return NextResponse.json({ status: 'sent', message });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '메시지를 보내지 못했습니다.' },
      { status: 500 },
    );
  }
}
