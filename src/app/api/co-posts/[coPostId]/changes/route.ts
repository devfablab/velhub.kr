import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { type CoPostPayload, getCoPost, getCoPostRole } from '@/lib/service/blog/coPosts';
import verifySession from '@/lib/session/verifySession';

type RouteContext = { params: Promise<{ coPostId: string }> };

type RevisionRow = { id: string; editor_id: string | null; payload: CoPostPayload; created_at: string };

function toSnapshot(revision: RevisionRow | undefined) {
  return {
    subject: revision?.payload.subject ?? '',
    summary: revision?.payload.summary ?? '',
    contentMarkdown: revision?.payload.content_markdown ?? '',
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { coPostId } = await context.params;
    const coPost = await getCoPost(coPostId);

    if (!coPost) {
      return NextResponse.json({ error: '공동 집필 글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({ siteId: null });
    const role = getCoPostRole(coPost, session.stigmaId);

    if (!role || !session.stigmaId) {
      return NextResponse.json({ error: '공동 집필 참여자만 볼 수 있습니다.' }, { status: 403 });
    }

    const revisionResult = await getSupabaseAdmin()
      .from('co_post_revisions')
      .select('id, editor_id, payload, created_at')
      .eq('co_post_id', coPost.id)
      .order('created_at', { ascending: true });

    if (revisionResult.error) {
      throw new Error('변경점을 불러오지 못했습니다.');
    }

    const revisions = (revisionResult.data ?? []) as RevisionRow[];
    const latest = revisions[revisions.length - 1];
    const myLastIndex = revisions.map((revision) => revision.editor_id).lastIndexOf(session.stigmaId);
    let baselineIndex = myLastIndex;

    if (baselineIndex < 0 && role === 'partner' && coPost.responded_at) {
      const respondedAt = new Date(coPost.responded_at).getTime();
      baselineIndex = revisions.findLastIndex((revision) => new Date(revision.created_at).getTime() <= respondedAt);
    }

    if (baselineIndex < 0) {
      baselineIndex = 0;
    }

    const laterRevisions = revisions.slice(baselineIndex + 1);
    const hasChanges = laterRevisions.some((revision) => revision.editor_id !== session.stigmaId);

    return NextResponse.json({
      hasChanges,
      baseline: toSnapshot(revisions[baselineIndex]),
      current: toSnapshot(latest),
      baselineAt: revisions[baselineIndex]?.created_at ?? null,
      lastChangedAt: latest?.created_at ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '변경점을 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}
