import { NextRequest } from 'next/server';
import { uploadGitHubImage } from '@/lib/github/labs';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

type Props = {
  params: Promise<{ issueNumber: string }>;
};

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

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

  const db = getSupabaseAdmin();
  const { data: dbIssue, error } = await db
    .from('concierge_labs_issues')
    .select('user_id')
    .eq('github_issue_number', issueNumber)
    .maybeSingle();

  if (error || !dbIssue) {
    return Response.json({ error: '이슈 정보를 찾을 수 없습니다.' }, { status: 404 });
  }

  const isAuthor = current.userId === dbIssue.user_id;
  const isAdmin = current.role === 'admin';

  if (!isAuthor && !isAdmin) {
    return Response.json({ error: '이미지 업로드 권한이 없습니다.' }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return Response.json({ error: '요청 데이터를 읽지 못했습니다.' }, { status: 400 });
  }

  const file = formData.get('images');
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: '이미지 파일이 전달되지 않았습니다.' }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return Response.json({ error: `지원하지 않는 이미지 형식입니다: ${file.name}` }, { status: 400 });
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return Response.json({ error: '이미지 용량은 10MB 이하여야 합니다.' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;

    const uploaded = await uploadGitHubImage({
      issueNumber,
      fileName,
      buffer,
    });

    return Response.json({
      ok: true,
      rawUrl: uploaded.rawUrl,
      downloadUrl: uploaded.downloadUrl,
    });
  } catch (err) {
    console.error('Image upload error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.' },
      { status: 500 },
    );
  }
}
