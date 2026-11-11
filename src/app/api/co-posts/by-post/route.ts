import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import {
  getCoPostBySiteAndSlug,
  getCoPostParticipantName,
  getCoPostRole,
  getLatestCoPostRevision,
  isCoPostLockHeld,
} from '@/lib/service/blog/coPosts';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const siteName = normalizeText(searchParams.get('siteName')).toLowerCase();
    const slug = normalizeText(searchParams.get('slug'));
    const coPost = await getCoPostBySiteAndSlug(siteName, slug);

    if (!coPost) {
      return NextResponse.json({ coPost: null });
    }

    const session = await verifySession({ siteId: null });
    const role = getCoPostRole(coPost, session.stigmaId);

    if (!role || !session.stigmaId) {
      return NextResponse.json({ error: '공동 집필 참여자만 볼 수 있습니다.' }, { status: 403 });
    }

    const otherId = role === 'inviter' ? coPost.partner_id : coPost.inviter_id;
    const otherSiteId = role === 'inviter' ? coPost.partner_site_id : coPost.inviter_site_id;
    const [postResult, revision, otherName, lockHolderName] = await Promise.all([
      getSupabaseAdmin()
        .from('posts')
        .select('subject, slug, published_status, published_at')
        .eq('id', coPost.post_id)
        .maybeSingle(),
      getLatestCoPostRevision(coPost.id),
      getCoPostParticipantName(otherSiteId, otherId),
      coPost.lock_holder_id && coPost.lock_holder_id !== session.stigmaId
        ? getCoPostParticipantName(otherSiteId, coPost.lock_holder_id)
        : Promise.resolve(''),
    ]);

    if (postResult.error || !postResult.data) {
      return NextResponse.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const isLockHeld = isCoPostLockHeld(coPost);

    return NextResponse.json({
      coPost: {
        id: coPost.id,
        role,
        status: coPost.status,
        otherName,
        post: {
          subject: postResult.data.subject ?? '',
          slug: postResult.data.slug,
          publishedStatus: postResult.data.published_status,
          publishedAt: postResult.data.published_at,
        },
        working: {
          revisionId: revision?.id ?? null,
          subject: revision?.payload.subject ?? '',
          summary: revision?.payload.summary ?? '',
          contentHtml: revision?.payload.content_html ?? '',
          contentMarkdown: revision?.payload.content_markdown ?? '',
        },
        lock: {
          isLockedByOther: isLockHeld && coPost.lock_holder_id !== session.stigmaId,
          holderName: isLockHeld && coPost.lock_holder_id !== session.stigmaId ? lockHolderName : '',
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '공동 집필 글을 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}
