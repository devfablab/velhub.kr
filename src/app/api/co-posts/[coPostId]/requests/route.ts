import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { NOTIFICATION_TYPE } from '@/lib/notifications/types';
import {
  acceptCoPostRequest,
  CO_POST_REQUEST_COLUMNS,
  type CoPostRequestRow,
  type CoPostRequestType,
  getCoPost,
  getCoPostOtherParty,
  getCoPostPublishState,
  getCoPostRole,
  getLatestCoPostRevision,
  sendCoPostNotification,
} from '@/lib/service/blog/coPosts';
import verifySession from '@/lib/session/verifySession';

type RouteContext = { params: Promise<{ coPostId: string }> };

const REQUEST_NOTIFICATION = {
  publish: NOTIFICATION_TYPE.CO_POST_PUBLISH_REQUESTED,
  reschedule: NOTIFICATION_TYPE.CO_POST_RESCHEDULE_REQUESTED,
  apply_revision: NOTIFICATION_TYPE.CO_POST_REVISION_REQUESTED,
  unpublish: NOTIFICATION_TYPE.CO_POST_UNPUBLISH_REQUESTED,
} as const;

function isRequestType(value: unknown): value is CoPostRequestType {
  return value === 'publish' || value === 'reschedule' || value === 'apply_revision' || value === 'unpublish';
}

async function getAccess(coPostId: string) {
  const coPost = await getCoPost(coPostId);

  if (!coPost || coPost.status !== 'active') return null;

  const session = await verifySession({ siteId: null });

  if (!getCoPostRole(coPost, session.stigmaId) || !session.stigmaId) return null;

  return { coPost, stigmaId: session.stigmaId };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { coPostId } = await context.params;
    const access = await getAccess(coPostId);

    if (!access) {
      return NextResponse.json({ error: '공동 집필 참여자만 볼 수 있습니다.' }, { status: 403 });
    }

    const [requestResult, publishState, latestRevision, postResult] = await Promise.all([
      getSupabaseAdmin()
        .from('co_post_requests')
        .select(CO_POST_REQUEST_COLUMNS)
        .eq('co_post_id', access.coPost.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      getCoPostPublishState(access.coPost.post_id),
      getLatestCoPostRevision(access.coPost.id),
      getSupabaseAdmin()
        .from('posts')
        .select('subject, summary, content_html, content_markdown')
        .eq('id', access.coPost.post_id)
        .maybeSingle(),
    ]);

    if (requestResult.error) {
      throw new Error('요청 목록을 불러오지 못했습니다.');
    }

    const payload = latestRevision?.payload;
    const post = postResult.data;
    const hasUnappliedRevision =
      publishState.state !== 'draft' &&
      Boolean(payload && post) &&
      (payload?.subject !== post?.subject ||
        (payload?.summary ?? null) !== (post?.summary ?? null) ||
        payload?.content_html !== post?.content_html);

    return NextResponse.json({
      publishState,
      hasUnappliedRevision,
      requests: ((requestResult.data ?? []) as CoPostRequestRow[]).map((row) => ({
        id: row.id,
        type: row.request_type,
        isMine: row.requester_id === access.stigmaId,
        publishAt: row.publish_at,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '요청 목록을 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { coPostId } = await context.params;
    const access = await getAccess(coPostId);

    if (!access) {
      return NextResponse.json({ error: '공동 집필 참여자만 요청할 수 있습니다.' }, { status: 403 });
    }

    const requestBody = (await request.json().catch(() => null)) as { type?: unknown; publishAt?: unknown } | null;
    const type = requestBody?.type;

    if (!isRequestType(type)) {
      return NextResponse.json({ error: '요청을 처리할 수 없습니다.' }, { status: 400 });
    }

    const { coPost, stigmaId } = access;
    const publishState = await getCoPostPublishState(coPost.post_id);
    let publishAt: string | null = null;
    let revisionId: string | null = null;

    if (type === 'publish' || type === 'reschedule') {
      const publishTime = typeof requestBody?.publishAt === 'string' ? new Date(requestBody.publishAt).getTime() : NaN;

      if (Number.isNaN(publishTime) || publishTime <= Date.now()) {
        return NextResponse.json({ error: '공개 일시는 현재 시각 이후로 정해주세요.' }, { status: 400 });
      }

      if (type === 'publish' && publishState.state !== 'draft') {
        return NextResponse.json({ error: '이미 공개 일시가 정해진 글입니다.' }, { status: 400 });
      }

      if (type === 'reschedule' && publishState.state !== 'scheduled') {
        return NextResponse.json({ error: '공개 예정인 글만 공개 일시를 바꿀 수 있습니다.' }, { status: 400 });
      }

      publishAt = new Date(publishTime).toISOString();
    }

    if (type === 'apply_revision') {
      if (publishState.state === 'draft') {
        return NextResponse.json({ error: '공개된 글만 수정본을 반영할 수 있습니다.' }, { status: 400 });
      }

      revisionId = (await getLatestCoPostRevision(coPost.id))?.id ?? null;

      if (!revisionId) {
        return NextResponse.json({ error: '반영할 수정본이 없습니다.' }, { status: 400 });
      }
    }

    if (type === 'unpublish' && (publishState.state === 'draft' || publishState.isClosed)) {
      return NextResponse.json({ error: '공개된 글만 삭제를 요청할 수 있습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const nowIsoString = new Date().toISOString();
    const groupTypes: CoPostRequestType[] =
      type === 'publish' || type === 'reschedule' ? ['publish', 'reschedule'] : [type];

    await supabaseAdmin
      .from('co_post_requests')
      .update({ status: 'canceled', responded_at: nowIsoString })
      .eq('co_post_id', coPost.id)
      .eq('requester_id', stigmaId)
      .eq('status', 'pending')
      .in('request_type', groupTypes);

    const insertResult = await supabaseAdmin
      .from('co_post_requests')
      .insert({
        co_post_id: coPost.id,
        request_type: type,
        requester_id: stigmaId,
        publish_at: publishAt,
        revision_id: revisionId,
      })
      .select(CO_POST_REQUEST_COLUMNS)
      .single();

    if (insertResult.error || !insertResult.data) {
      throw new Error('요청을 보내지 못했습니다.');
    }

    const created = insertResult.data as CoPostRequestRow;

    if (type === 'publish' && publishAt) {
      const matchResult = await supabaseAdmin
        .from('co_post_requests')
        .select(CO_POST_REQUEST_COLUMNS)
        .eq('co_post_id', coPost.id)
        .eq('status', 'pending')
        .eq('request_type', 'publish')
        .neq('requester_id', stigmaId)
        .eq('publish_at', publishAt)
        .maybeSingle();

      if (matchResult.data) {
        await acceptCoPostRequest(coPost, matchResult.data as CoPostRequestRow, stigmaId);

        return NextResponse.json({ status: 'agreed' });
      }
    }

    const other = getCoPostOtherParty(coPost, stigmaId);

    await sendCoPostNotification({
      type: REQUEST_NOTIFICATION[type],
      recipientId: other.id,
      recipientSiteId: other.siteId,
      senderId: stigmaId,
      postId: coPost.post_id,
    });

    return NextResponse.json({ status: 'requested', requestId: created.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '요청을 보내지 못했습니다.' },
      { status: 500 },
    );
  }
}
