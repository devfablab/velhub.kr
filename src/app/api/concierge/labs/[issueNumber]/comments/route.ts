import { NextRequest } from 'next/server';
import { createGitHubIssueComment, getGitHubIssueComments } from '@/lib/github/labs';
import { getCurrentStigma } from '@/lib/session/utils';

type Props = {
  params: Promise<{ issueNumber: string }>;
};

export async function GET(request: NextRequest, { params }: Props) {
  const { issueNumber: issueNumberParam } = await params;
  const issueNumber = Number(issueNumberParam);

  if (!issueNumber || Number.isNaN(issueNumber)) {
    return Response.json({ error: '유효하지 않은 이슈 번호입니다.' }, { status: 400 });
  }

  try {
    const comments = await getGitHubIssueComments({ issueNumber });
    return Response.json({ comments });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : '댓글을 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, { params }: Props) {
  const { issueNumber: issueNumberParam } = await params;
  const issueNumber = Number(issueNumberParam);

  if (!issueNumber || Number.isNaN(issueNumber)) {
    return Response.json({ error: '유효하지 않은 이슈 번호입니다.' }, { status: 400 });
  }

  const current = await getCurrentStigma();
  if (!current?.userId) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  // Only admin can write comments on 데브허브
  if (current.role !== 'admin') {
    return Response.json({ error: '댓글 작성 권한이 없습니다. 관리자만 작성할 수 있습니다.' }, { status: 403 });
  }

  const bodyData = await request.json().catch(() => null);
  const commentText = (bodyData?.body as string)?.trim();

  if (!commentText) {
    return Response.json({ error: '댓글 내용을 입력해 주세요.' }, { status: 400 });
  }

  try {
    const comment = await createGitHubIssueComment({
      issueNumber,
      body: commentText,
    });

    return Response.json({ ok: true, comment });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : '댓글 작성에 실패했습니다.' }, { status: 500 });
  }
}
