import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { NOTIFICATION_TYPE } from '@/lib/notifications/types';
import {
  acceptCoPostRequest,
  CO_POST_REQUEST_COLUMNS,
  type CoPostRequestRow,
  getCoPost,
  getCoPostOtherParty,
  getCoPostRole,
  sendCoPostNotification,
} from '@/lib/service/blog/coPosts';
import verifySession from '@/lib/session/verifySession';

type RouteContext = { params: Promise<{ coPostId: string; requestId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { coPostId, requestId } = await context.params;
    const coPost = await getCoPost(coPostId);
    const session = await verifySession({ siteId: null });
    const stigmaId = session.stigmaId;

    if (!coPost || coPost.status !== 'active' || !getCoPostRole(coPost, stigmaId) || !stigmaId) {
      return NextResponse.json({ error: '공동 집필 참여자만 응답할 수 있습니다.' }, { status: 403 });
    }

    if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
      return NextResponse.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const requestResult = await supabaseAdmin
      .from('co_post_requests')
      .select(CO_POST_REQUEST_COLUMNS)
      .eq('id', requestId)
      .eq('co_post_id', coPost.id)
      .maybeSingle();
    const coPostRequest = requestResult.data as CoPostRequestRow | null;

    if (!coPostRequest || coPostRequest.status !== 'pending') {
      return NextResponse.json({ error: '이미 처리된 요청입니다.' }, { status: 400 });
    }

    const requestBody = (await request.json().catch(() => null)) as { action?: unknown } | null;
    const action = requestBody?.action;
    const isRequester = coPostRequest.requester_id === stigmaId;

    if (action === 'cancel') {
      if (!isRequester) {
        return NextResponse.json({ error: '요청한 사람만 취소할 수 있습니다.' }, { status: 403 });
      }

      await supabaseAdmin
        .from('co_post_requests')
        .update({ status: 'canceled', responded_at: new Date().toISOString() })
        .eq('id', coPostRequest.id);

      return NextResponse.json({ ok: true });
    }

    if (isRequester) {
      return NextResponse.json({ error: '상대가 보낸 요청에만 응답할 수 있습니다.' }, { status: 403 });
    }

    if (action === 'accept') {
      await acceptCoPostRequest(coPost, coPostRequest, stigmaId);

      return NextResponse.json({ ok: true });
    }

    if (action === 'decline') {
      await supabaseAdmin
        .from('co_post_requests')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('id', coPostRequest.id);

      const requester = getCoPostOtherParty(coPost, stigmaId);

      await sendCoPostNotification({
        type: NOTIFICATION_TYPE.CO_POST_REQUEST_DECLINED,
        recipientId: requester.id,
        recipientSiteId: requester.siteId,
        senderId: stigmaId,
        postId: coPost.post_id,
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: '요청을 처리할 수 없습니다.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '요청을 처리하지 못했습니다.' },
      { status: 500 },
    );
  }
}
