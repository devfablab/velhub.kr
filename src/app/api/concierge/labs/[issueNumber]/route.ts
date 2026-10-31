import { NextRequest } from 'next/server';
import {
  getGitHubIssue,
  isLabsCategory,
  isLabsStatus,
  LabsCategory,
  LabsStatus,
  updateGitHubIssue,
} from '@/lib/github/labs';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

type Props = {
  params: Promise<{ issueNumber: string }>;
};

export async function GET(request: NextRequest, { params }: Props) {
  const { issueNumber: issueNumberParam } = await params;
  const issueNumber = Number(issueNumberParam);

  if (!issueNumber || Number.isNaN(issueNumber)) {
    return Response.json({ error: '유효하지 않은 이슈 번호입니다.' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const current = await getCurrentStigma();

  const { data: dbIssue, error } = await db
    .from('concierge_labs_issues')
    .select('*')
    .eq('github_issue_number', issueNumber)
    .maybeSingle();

  if (error || !dbIssue) {
    return Response.json({ error: '이슈 정보를 찾을 수 없습니다.' }, { status: 404 });
  }

  try {
    const gitHubIssue = await getGitHubIssue({ issueNumber });

    const isAuthor = Boolean(current?.userId && current.userId === dbIssue.user_id);
    const isAdmin = Boolean(current?.role === 'admin');

    return Response.json({
      issue: dbIssue,
      gitHubIssue,
      isAuthor,
      isAdmin,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'GitHub 이슈를 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const { issueNumber: issueNumberParam } = await params;
  const issueNumber = Number(issueNumberParam);

  if (!issueNumber || Number.isNaN(issueNumber)) {
    return Response.json({ error: '유효하지 않은 이슈 번호입니다.' }, { status: 400 });
  }

  const current = await getCurrentStigma();
  if (!current?.userId) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  const { data: dbIssue, error } = await db
    .from('concierge_labs_issues')
    .select('*')
    .eq('github_issue_number', issueNumber)
    .maybeSingle();

  if (error || !dbIssue) {
    return Response.json({ error: '이슈 정보를 찾을 수 없습니다.' }, { status: 404 });
  }

  const isAuthor = current.userId === dbIssue.user_id;
  const isAdmin = current.role === 'admin';

  if (!isAuthor && !isAdmin) {
    return Response.json({ error: '수정 권한이 없습니다.' }, { status: 403 });
  }

  const bodyData = await request.json().catch(() => null);
  if (!bodyData) {
    return Response.json({ error: '요청 데이터를 읽지 못했습니다.' }, { status: 400 });
  }

  const { title, content, category, status, action } = bodyData;

  const updatesForDb: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  let nextState: 'open' | 'closed' | undefined;

  // 1. Author action: cancel/close
  if (action === 'cancel' || action === 'close') {
    if (!isAuthor && !isAdmin) {
      return Response.json({ error: '권한이 없습니다.' }, { status: 403 });
    }
    nextState = 'closed';
    updatesForDb.status = '반려됨';
  }

  // 2. Author or Admin edit title, content, category
  if (isAuthor || isAdmin) {
    if (title && typeof title === 'string') updatesForDb.title = title.trim();
    if (category && isLabsCategory(category)) updatesForDb.category = category;
  }

  // 3. Admin edit status
  if (isAdmin && status && isLabsStatus(status)) {
    updatesForDb.status = status;
    if (status === '반영 완료' || status === '반려됨') {
      nextState = 'closed';
    } else {
      nextState = 'open';
    }
  }

  try {
    await updateGitHubIssue({
      issueNumber,
      title: updatesForDb.title as string | undefined,
      body: content as string | undefined,
      category: updatesForDb.category as LabsCategory | undefined,
      status: updatesForDb.status as LabsStatus | undefined,
      state: nextState,
    });

    const { error: updateError } = await db
      .from('concierge_labs_issues')
      .update(updatesForDb)
      .eq('github_issue_number', issueNumber);

    if (updateError) {
      console.error('Supabase update error:', updateError);
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Issue patch error:', error);
    return Response.json({ error: error instanceof Error ? error.message : '이슈 수정에 실패했습니다.' }, { status: 500 });
  }
}
