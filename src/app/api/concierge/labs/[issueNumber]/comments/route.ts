import { NextRequest } from 'next/server';
import { createGitHubIssueComment, getGitHubIssueComments } from '@/lib/github/labs';
import { getCurrentStigma } from '@/lib/session/utils';

type Props = {
  params: Promise<{ issueNumber: string }>;
};

function getGitHubConfig() {
  const token = process.env.GITHUB_TOKEN?.trim();
  const owner = process.env.GITHUB_REPO_OWNER?.trim();
  const repo = process.env.GITHUB_REPO_NAME?.trim();

  if (!token || !owner || !repo) {
    throw new Error('GitHub 연동 환경변수(GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME)가 설정되지 않았습니다.');
  }

  return { token, owner, repo };
}

function getHeaders(token: string) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'velhub-concierge-labs',
  };
}

async function updateGitHubCommentInternal({
  commentId,
  body,
}: {
  commentId: number;
  body: string;
}) {
  const { token, owner, repo } = getGitHubConfig();

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/comments/${commentId}`, {
    method: 'PATCH',
    headers: {
      ...getHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'GitHub 댓글 수정에 실패했습니다.');
  }

  return {
    id: data.id as number,
    body: data.body as string,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    author: {
      login: data.user?.login || 'admin',
      avatarUrl: data.user?.avatar_url || '',
    },
  };
}

export async function GET(request: NextRequest, { params }: Props) {
  const { issueNumber: issueNumberParam } = await params;
  const issueNumber = Number(issueNumberParam);

  if (!issueNumber || Number.isNaN(issueNumber)) {
    return Response.json({ error: '유효하지 않은 이슈 번호입니다.' }, { status: 400 });
  }

  try {
    const comments = await getGitHubIssueComments({ issueNumber });
    return Response.json({ comments });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '댓글을 불러오지 못했습니다.' },
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
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '댓글 작성에 실패했습니다.' }, { status: 500 });
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

  // Only admin can edit comments on 데브허브
  if (current.role !== 'admin') {
    return Response.json({ error: '댓글 수정 권한이 없습니다. 관리자만 수정할 수 있습니다.' }, { status: 403 });
  }

  const bodyData = await request.json().catch(() => null);
  const commentId = Number(bodyData?.commentId);
  const commentText = (bodyData?.body as string)?.trim();

  if (!commentId || Number.isNaN(commentId)) {
    return Response.json({ error: '유효하지 않은 댓글 ID입니다.' }, { status: 400 });
  }

  if (!commentText) {
    return Response.json({ error: '댓글 내용을 입력해 주세요.' }, { status: 400 });
  }

  try {
    const updatedComment = await updateGitHubCommentInternal({
      commentId,
      body: commentText,
    });

    return Response.json({ ok: true, comment: updatedComment });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '댓글 수정에 실패했습니다.' }, { status: 500 });
  }
}
