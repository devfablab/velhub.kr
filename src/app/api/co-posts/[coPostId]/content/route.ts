import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { getCoPost, getCoPostRole, getLatestCoPostRevision } from '@/lib/service/blog/coPosts';
import verifySession from '@/lib/session/verifySession';

type RouteContext = { params: Promise<{ coPostId: string }> };

type RequestBody = {
  subject?: unknown;
  summary?: unknown;
  contentHtml?: unknown;
  contentMarkdown?: unknown;
};

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { coPostId } = await context.params;
    const requestBody = (await request.json().catch(() => null)) as RequestBody | null;
    const coPost = await getCoPost(coPostId);

    if (!coPost || (coPost.status !== 'active' && coPost.status !== 'invited')) {
      return NextResponse.json({ error: '공동 집필 글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({ siteId: null });
    const stigmaId = session.stigmaId;

    const role = getCoPostRole(coPost, stigmaId);

    if (!role || !stigmaId || (coPost.status === 'invited' && role !== 'inviter')) {
      return NextResponse.json({ error: '공동 집필 참여자만 수정할 수 있습니다.' }, { status: 403 });
    }

    if (coPost.lock_holder_id !== stigmaId) {
      return NextResponse.json(
        { error: '수정 권한이 상대에게 넘어갔습니다. 채팅으로 상의해 주세요.' },
        { status: 409 },
      );
    }

    const subject = getString(requestBody?.subject);
    const summary = getString(requestBody?.summary);
    const contentHtml = getString(requestBody?.contentHtml);
    const contentMarkdown = getString(requestBody?.contentMarkdown);

    if (!subject) {
      return NextResponse.json({ error: '제목을 입력해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const latestRevision = await getLatestCoPostRevision(coPost.id);
    const payload = {
      ...(latestRevision?.payload ?? {}),
      subject,
      summary: summary || null,
      content_html: contentHtml,
      content_markdown: contentMarkdown,
    };
    const nowIsoString = new Date().toISOString();
    const revisionResult = await supabaseAdmin
      .from('co_post_revisions')
      .insert({ co_post_id: coPost.id, editor_id: stigmaId, payload })
      .select('id')
      .single();

    if (revisionResult.error) {
      throw new Error('저장하지 못했습니다.');
    }

    const postResult = await supabaseAdmin
      .from('posts')
      .select('published_status')
      .eq('id', coPost.post_id)
      .maybeSingle();

    if (postResult.data?.published_status === 'draft') {
      const updateResult = await supabaseAdmin
        .from('posts')
        .update({
          subject,
          summary: summary || null,
          content_html: contentHtml,
          content_markdown: contentMarkdown,
          updated_at: nowIsoString,
        })
        .eq('id', coPost.post_id);

      if (updateResult.error) {
        throw new Error('저장하지 못했습니다.');
      }
    }

    await supabaseAdmin
      .from('co_posts')
      .update({ lock_seen_at: nowIsoString, lock_active_at: nowIsoString, updated_at: nowIsoString })
      .eq('id', coPost.id)
      .eq('lock_holder_id', stigmaId);

    return NextResponse.json({ ok: true, revisionId: revisionResult.data.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '저장하지 못했습니다.' },
      { status: 500 },
    );
  }
}
