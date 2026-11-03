export type LabsCategory = '신규 기능' | '기능 개선' | 'UI/UX 개선' | '기타 제안';
export type LabsStatus = '미확인' | '검토 중' | '진행 중' | '반영 완료' | '반려됨';

export const LABS_CATEGORIES: LabsCategory[] = ['신규 기능', '기능 개선', 'UI/UX 개선', '기타 제안'];
export const LABS_STATUSES: LabsStatus[] = ['미확인', '검토 중', '진행 중', '반영 완료', '반려됨'];

export function isLabsCategory(value: unknown): value is LabsCategory {
  return typeof value === 'string' && LABS_CATEGORIES.includes(value as LabsCategory);
}

export function isLabsStatus(value: unknown): value is LabsStatus {
  return typeof value === 'string' && LABS_STATUSES.includes(value as LabsStatus);
}

function getGitHubConfig() {
  const token = process.env.GITHUB_TOKEN?.trim();
  const owner = process.env.GITHUB_REPO_OWNER?.trim();
  const repo = process.env.GITHUB_REPO_NAME?.trim();
  const branch = process.env.GITHUB_TARGET_BRANCH?.trim() || 'main';

  if (!token || !owner || !repo) {
    throw new Error('GitHub 연동 환경변수(GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME)가 설정되지 않았습니다.');
  }

  return { token, owner, repo, branch };
}

function getHeaders(token: string) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'velhub-concierge-labs',
  };
}

export async function createGitHubIssue({
  title,
  body,
  category,
  status = '미확인',
}: {
  title: string;
  body: string;
  category: LabsCategory;
  status?: LabsStatus;
}) {
  const { token, owner, repo } = getGitHubConfig();

  const labels = [`type: ${category}`, `status: ${status}`];

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      ...getHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      body,
      labels,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || '이슈 생성에 실패했습니다.');
  }

  return {
    number: data.number as number,
    htmlUrl: data.html_url as string,
    title: data.title as string,
    body: (data.body as string) || '',
    state: data.state as 'open' | 'closed',
    labels: (data.labels as Array<{ name: string }>) || [],
    createdAt: data.created_at as string,
  };
}

export async function uploadGitHubImage({
  issueNumber,
  fileName,
  buffer,
}: {
  issueNumber: number;
  fileName: string;
  buffer: Buffer;
}) {
  const { token, owner, repo, branch } = getGitHubConfig();

  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `issues/${issueNumber}/${sanitizedFileName}`;

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      ...getHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `upload issue image: ${sanitizedFileName}`,
      content: buffer.toString('base64'),
      branch,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'GitHub 이미지 업로드에 실패했습니다.');
  }

  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const downloadUrl = (data.content?.download_url as string) || rawUrl;

  return {
    path,
    downloadUrl,
    rawUrl,
  };
}

export async function updateGitHubIssue({
  issueNumber,
  title,
  body,
  category,
  status,
  state,
}: {
  issueNumber: number;
  title?: string;
  body?: string;
  category?: LabsCategory;
  status?: LabsStatus;
  state?: 'open' | 'closed';
}) {
  const { token, owner, repo } = getGitHubConfig();

  const payload: Record<string, unknown> = {};
  if (title !== undefined) payload.title = title;
  if (body !== undefined) payload.body = body;
  if (state !== undefined) payload.state = state;

  if (category || status) {
    const current = await getGitHubIssue({ issueNumber });
    const existingLabels = current.labels.map((labelItem) => labelItem.name);
    const otherLabels = existingLabels.filter(
      (labelItem) => !labelItem.startsWith('type: ') && !labelItem.startsWith('status: '),
    );

    const nextCategory =
      category ||
      existingLabels.find((labelItem) => labelItem.startsWith('type: '))?.replace('type: ', '') ||
      '기능 개선';
    const nextStatus =
      status ||
      existingLabels.find((labelItem) => labelItem.startsWith('status: '))?.replace('status: ', '') ||
      '미확인';

    payload.labels = [...otherLabels, `type: ${nextCategory}`, `status: ${nextStatus}`];
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
    method: 'PATCH',
    headers: {
      ...getHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || '이슈 수정에 실패했습니다.');
  }

  return {
    number: data.number as number,
    htmlUrl: data.html_url as string,
    title: data.title as string,
    body: (data.body as string) || '',
    state: data.state as 'open' | 'closed',
    labels: (data.labels as Array<{ name: string }>) || [],
    updatedAt: data.updated_at as string,
    closedAt: (data.closed_at as string | null) || null,
  };
}

export async function getGitHubIssue({ issueNumber }: { issueNumber: number }) {
  const { token, owner, repo } = getGitHubConfig();

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
    method: 'GET',
    headers: getHeaders(token),
    cache: 'no-store',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || '이슈 조회에 실패했습니다.');
  }

  return {
    number: data.number as number,
    htmlUrl: data.html_url as string,
    title: data.title as string,
    body: (data.body as string) || '',
    state: data.state as 'open' | 'closed',
    labels: (data.labels as Array<{ name: string }>) || [],
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    closedAt: (data.closed_at as string | null) || null,
    author: {
      login: data.user?.login as string,
      avatarUrl: data.user?.avatar_url as string,
    },
  };
}

export type LabsIssueComment = {
  id: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: {
    login: string;
    avatarUrl: string;
  };
};

type GitHubCommentApiItem = {
  id: number;
  body?: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    login?: string;
    avatar_url?: string;
  } | null;
};

export async function getGitHubIssueComments({ issueNumber }: { issueNumber: number }): Promise<LabsIssueComment[]> {
  const { token, owner, repo } = getGitHubConfig();

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    method: 'GET',
    headers: getHeaders(token),
    cache: 'no-store',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'GitHub 댓글 조회에 실패했습니다.');
  }

  return (data as GitHubCommentApiItem[]).map((item) => ({
    id: item.id,
    body: item.body || '',
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    author: {
      login: item.user?.login || 'GitHub User',
      avatarUrl: item.user?.avatar_url || '',
    },
  }));
}

export async function createGitHubIssueComment({ issueNumber, body }: { issueNumber: number; body: string }) {
  const { token, owner, repo } = getGitHubConfig();

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    method: 'POST',
    headers: {
      ...getHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'GitHub 댓글 작성에 실패했습니다.');
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

export async function updateGitHubIssueComment({ commentId, body }: { commentId: number; body: string }) {
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
