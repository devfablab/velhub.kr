import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import {
  CO_POST_MESSAGE_MAX_LENGTH,
  CO_POST_MESSAGE_PAGE_SIZE,
  type CoPostMessageRow,
  getCoPost,
  getCoPostParticipants,
  getCoPostRole,
  toCoPostMessage,
} from '@/lib/service/blog/coPosts';
import {
  callCommunityChatWorker,
  createCommunityChatToken,
  getCommunityChatWorkerUrl,
} from '@/lib/service/community/communityChat';
import verifySession from '@/lib/session/verifySession';

type RouteContext = { params: Promise<{ coPostId: string }> };

const MESSAGE_COLUMNS = 'id, co_post_id, sender_id, body, is_deleted, created_at';

async function getAccess(coPostId: string) {
  const coPost = await getCoPost(coPostId);

  if (!coPost || coPost.status !== 'active') return null;

  const session = await verifySession({ siteId: null });

  if (!getCoPostRole(coPost, session.stigmaId) || !session.stigmaId) return null;

  return { coPost, stigmaId: session.stigmaId };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { coPostId } = await context.params;
    const access = await getAccess(coPostId);

    if (!access) {
      return NextResponse.json({ error: '공동 집필 참여자만 볼 수 있습니다.' }, { status: 403 });
    }

    const before = new URL(request.url).searchParams.get('before');
    let query = getSupabaseAdmin()
      .from('co_post_messages')
      .select(MESSAGE_COLUMNS)
      .eq('co_post_id', access.coPost.id)
      .order('created_at', { ascending: false })
      .limit(CO_POST_MESSAGE_PAGE_SIZE);

    if (before && !Number.isNaN(new Date(before).getTime())) {
      query = query.lt('created_at', new Date(before).toISOString());
    }

    const [messageResult, participants] = await Promise.all([query, getCoPostParticipants(access.coPost)]);

    if (messageResult.error) {
      throw new Error('메시지를 불러오지 못했습니다.');
    }

    const rows = (messageResult.data ?? []) as CoPostMessageRow[];
    const workerUrl = getCommunityChatWorkerUrl().replace(/^http/, 'ws');
    const token = createCommunityChatToken(access.coPost.id, access.stigmaId);

    return NextResponse.json({
      myId: access.stigmaId,
      connectionUrl: `${workerUrl}/co-posts/${access.coPost.id}/ws?token=${encodeURIComponent(token)}`,
      messages: rows.map((row) => toCoPostMessage(row, participants)).reverse(),
      hasMore: rows.length >= CO_POST_MESSAGE_PAGE_SIZE,
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
    const { coPostId } = await context.params;
    const access = await getAccess(coPostId);

    if (!access) {
      return NextResponse.json({ error: '공동 집필 참여자만 보낼 수 있습니다.' }, { status: 403 });
    }

    const requestBody = (await request.json().catch(() => null)) as { body?: unknown } | null;
    const body = typeof requestBody?.body === 'string' ? requestBody.body.trim() : '';

    if (!body) {
      return NextResponse.json({ error: '메시지를 입력해 주세요.' }, { status: 400 });
    }

    if ([...body].length > CO_POST_MESSAGE_MAX_LENGTH) {
      return NextResponse.json(
        { error: `메시지는 ${CO_POST_MESSAGE_MAX_LENGTH.toLocaleString()}자 이하로 입력해 주세요.` },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const insertResult = await supabaseAdmin
      .from('co_post_messages')
      .insert({ co_post_id: access.coPost.id, sender_id: access.stigmaId, body })
      .select(MESSAGE_COLUMNS)
      .single();

    if (insertResult.error || !insertResult.data) {
      throw new Error('메시지를 보내지 못했습니다.');
    }

    if (access.coPost.lock_holder_id === access.stigmaId) {
      const nowIsoString = new Date().toISOString();

      await supabaseAdmin
        .from('co_posts')
        .update({ lock_seen_at: nowIsoString, lock_active_at: nowIsoString })
        .eq('id', access.coPost.id)
        .eq('lock_holder_id', access.stigmaId);
    }

    const message = toCoPostMessage(insertResult.data as CoPostMessageRow, await getCoPostParticipants(access.coPost));

    await callCommunityChatWorker(`/co-posts/${access.coPost.id}/broadcast`, {
      method: 'POST',
      body: JSON.stringify({ type: 'message', message }),
    }).catch(() => undefined);

    return NextResponse.json({ message });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '메시지를 보내지 못했습니다.' },
      { status: 500 },
    );
  }
}
