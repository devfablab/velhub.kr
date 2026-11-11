import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import {
  CO_POST_LOCK_IDLE_TIMEOUT,
  CO_POST_LOCK_SEEN_TIMEOUT,
  getCoPost,
  getCoPostParticipantName,
  getCoPostRole,
} from '@/lib/service/blog/coPosts';
import verifySession from '@/lib/session/verifySession';

type RouteContext = { params: Promise<{ coPostId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { coPostId } = await context.params;
    const requestBody = (await request.json().catch(() => null)) as { action?: unknown } | null;
    const action = requestBody?.action;
    const coPost = await getCoPost(coPostId);

    if (!coPost || (coPost.status !== 'active' && coPost.status !== 'invited')) {
      return NextResponse.json({ error: '공동 집필 글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({ siteId: null });
    const role = getCoPostRole(coPost, session.stigmaId);
    const stigmaId = session.stigmaId;

    if (!role || !stigmaId || (coPost.status === 'invited' && role !== 'inviter')) {
      return NextResponse.json({ error: '공동 집필 참여자만 수정할 수 있습니다.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const now = Date.now();
    const nowIsoString = new Date(now).toISOString();

    if (action === 'acquire') {
      const seenLimit = new Date(now - CO_POST_LOCK_SEEN_TIMEOUT).toISOString();
      const idleLimit = new Date(now - CO_POST_LOCK_IDLE_TIMEOUT).toISOString();
      const updateResult = await supabaseAdmin
        .from('co_posts')
        .update({ lock_holder_id: stigmaId, lock_seen_at: nowIsoString, lock_active_at: nowIsoString })
        .eq('id', coPost.id)
        .or(
          `lock_holder_id.is.null,lock_holder_id.eq.${stigmaId},lock_seen_at.lt.${seenLimit},lock_active_at.lt.${idleLimit}`,
        )
        .select('id');

      if (updateResult.error) {
        throw new Error('수정을 시작하지 못했습니다.');
      }

      if ((updateResult.data ?? []).length === 0) {
        const otherSiteId = role === 'inviter' ? coPost.partner_site_id : coPost.inviter_site_id;
        const holderName = coPost.lock_holder_id
          ? await getCoPostParticipantName(otherSiteId, coPost.lock_holder_id)
          : '';

        return NextResponse.json({ status: 'locked', holderName });
      }

      return NextResponse.json({ status: 'acquired' });
    }

    if (coPost.lock_holder_id !== stigmaId) {
      return NextResponse.json({ status: 'lost' });
    }

    if (action === 'heartbeat' || action === 'activity') {
      if (coPost.lock_active_at && now - new Date(coPost.lock_active_at).getTime() >= CO_POST_LOCK_IDLE_TIMEOUT) {
        return NextResponse.json({ status: 'expired' });
      }

      const updateResult = await supabaseAdmin
        .from('co_posts')
        .update(
          action === 'activity'
            ? { lock_seen_at: nowIsoString, lock_active_at: nowIsoString }
            : { lock_seen_at: nowIsoString },
        )
        .eq('id', coPost.id)
        .eq('lock_holder_id', stigmaId);

      if (updateResult.error) {
        throw new Error('수정 상태를 갱신하지 못했습니다.');
      }

      return NextResponse.json({ status: 'held' });
    }

    if (action === 'release') {
      await supabaseAdmin
        .from('co_posts')
        .update({ lock_holder_id: null, lock_seen_at: null, lock_active_at: null })
        .eq('id', coPost.id)
        .eq('lock_holder_id', stigmaId);

      return NextResponse.json({ status: 'released' });
    }

    return NextResponse.json({ error: '요청을 처리할 수 없습니다.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '요청을 처리하지 못했습니다.' },
      { status: 500 },
    );
  }
}
