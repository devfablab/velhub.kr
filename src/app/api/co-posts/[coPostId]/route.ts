import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { NOTIFICATION_TYPE } from '@/lib/notifications/types';
import { getCoPost, getCoPostRole, sendCoPostNotification } from '@/lib/service/blog/coPosts';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';

type RouteContext = { params: Promise<{ coPostId: string }> };

type RequestBody = {
  action?: unknown;
  categoryIds?: unknown;
  seriesId?: unknown;
};

async function belongsToSite(table: 'board_categories' | 'board_series', ids: string[], siteId: string) {
  if (ids.length === 0) return true;

  const result = await getSupabaseAdmin().from(table).select('id').in('id', ids).eq('site_id', siteId);

  return !result.error && (result.data ?? []).length === ids.length;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { coPostId } = await context.params;
    const requestBody = (await request.json().catch(() => null)) as RequestBody | null;
    const action = requestBody?.action;
    const coPost = await getCoPost(coPostId);

    if (!coPost) {
      return NextResponse.json({ error: '공동 집필을 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({ siteId: null });
    const role = getCoPostRole(coPost, session.stigmaId);

    if (!role || !session.stigmaId) {
      return NextResponse.json({ error: '공동 집필 참여자만 할 수 있습니다.' }, { status: 403 });
    }

    if (coPost.status !== 'invited') {
      return NextResponse.json({ error: '이미 처리된 초대입니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const nowIsoString = new Date().toISOString();

    if (action === 'accept' || action === 'decline') {
      if (role !== 'partner') {
        return NextResponse.json({ error: '초대받은 운영자만 수락하거나 거절할 수 있습니다.' }, { status: 403 });
      }

      const categoryIds = Array.isArray(requestBody?.categoryIds)
        ? Array.from(
            new Set(
              requestBody.categoryIds
                .filter((value): value is string => typeof value === 'string')
                .map((value) => normalizeText(value))
                .filter(Boolean),
            ),
          )
        : [];
      const seriesId = typeof requestBody?.seriesId === 'string' ? normalizeText(requestBody.seriesId) : '';

      if (action === 'accept') {
        if (!(await belongsToSite('board_categories', categoryIds, coPost.partner_site_id))) {
          return NextResponse.json({ error: '카테고리를 찾을 수 없습니다.' }, { status: 400 });
        }

        if (seriesId && !(await belongsToSite('board_series', [seriesId], coPost.partner_site_id))) {
          return NextResponse.json({ error: '연재를 찾을 수 없습니다.' }, { status: 400 });
        }
      }

      const updateResult = await supabaseAdmin
        .from('co_posts')
        .update({
          status: action === 'accept' ? 'active' : 'declined',
          partner_category_ids: action === 'accept' ? categoryIds : [],
          partner_series_id: action === 'accept' ? seriesId || null : null,
          responded_at: nowIsoString,
          updated_at: nowIsoString,
        })
        .eq('id', coPost.id)
        .eq('status', 'invited');

      if (updateResult.error) {
        throw new Error('초대에 응답하지 못했습니다.');
      }

      await sendCoPostNotification({
        type: action === 'accept' ? NOTIFICATION_TYPE.CO_POST_ACCEPTED : NOTIFICATION_TYPE.CO_POST_DECLINED,
        recipientId: coPost.inviter_id,
        recipientSiteId: coPost.inviter_site_id,
        senderId: coPost.partner_id,
        postId: coPost.post_id,
      });

      return NextResponse.json({ ok: true });
    }

    if (action === 'cancel') {
      if (role !== 'inviter') {
        return NextResponse.json({ error: '초대한 운영자만 취소할 수 있습니다.' }, { status: 403 });
      }

      const updateResult = await supabaseAdmin
        .from('co_posts')
        .update({ status: 'canceled', updated_at: nowIsoString })
        .eq('id', coPost.id)
        .eq('status', 'invited');

      if (updateResult.error) {
        throw new Error('초대를 취소하지 못했습니다.');
      }

      await sendCoPostNotification({
        type: NOTIFICATION_TYPE.CO_POST_CANCELED,
        recipientId: coPost.partner_id,
        recipientSiteId: coPost.partner_site_id,
        senderId: coPost.inviter_id,
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
