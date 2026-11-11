import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { getCoPost, getCoPostRole } from '@/lib/service/blog/coPosts';
import { callCommunityChatWorker } from '@/lib/service/community/communityChat';
import verifySession from '@/lib/session/verifySession';

type RouteContext = { params: Promise<{ coPostId: string; messageId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { coPostId, messageId } = await context.params;
    const coPost = await getCoPost(coPostId);
    const session = await verifySession({ siteId: null });

    if (!coPost || !getCoPostRole(coPost, session.stigmaId) || !session.stigmaId) {
      return NextResponse.json({ error: '공동 집필 참여자만 지울 수 있습니다.' }, { status: 403 });
    }

    if (!/^[0-9a-f-]{36}$/i.test(messageId)) {
      return NextResponse.json({ error: '메시지를 찾을 수 없습니다.' }, { status: 404 });
    }

    const updateResult = await getSupabaseAdmin()
      .from('co_post_messages')
      .update({ is_deleted: true, body: '', deleted_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('co_post_id', coPost.id)
      .eq('sender_id', session.stigmaId)
      .select('id');

    if (updateResult.error) {
      throw new Error('메시지를 지우지 못했습니다.');
    }

    if ((updateResult.data ?? []).length === 0) {
      return NextResponse.json({ error: '본인이 쓴 메시지만 지울 수 있습니다.' }, { status: 403 });
    }

    await callCommunityChatWorker(`/co-posts/${coPost.id}/broadcast`, {
      method: 'POST',
      body: JSON.stringify({ type: 'deleted', id: messageId }),
    }).catch(() => undefined);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '메시지를 지우지 못했습니다.' },
      { status: 500 },
    );
  }
}
