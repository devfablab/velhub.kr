import { NextRequest } from 'next/server';
import {
  createGitHubIssue,
  isLabsCategory,
  isLabsStatus,
  LabsCategory,
  updateGitHubIssue,
  uploadGitHubImage,
} from '@/lib/service/concierge/githubLabs';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { getStigmaDisplayName } from '@/lib/users/utils';

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE = 1 * 1024 * 1024; // 1MB

export async function GET(request: NextRequest) {
  const db = getSupabaseAdmin();
  const searchParams = request.nextUrl.searchParams;

  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20));
  const category = searchParams.get('category');
  const status = searchParams.get('status');
  const search = searchParams.get('search')?.trim();
  const isMy = searchParams.get('my') === 'true';

  let query = db.from('concierge_labs_issues').select('*', { count: 'exact' });

  if (category && isLabsCategory(category)) {
    query = query.eq('category', category);
  }

  if (status && isLabsStatus(status)) {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.ilike('title', `%${search}%`);
  }

  if (isMy) {
    const current = await getCurrentStigma();
    if (!current?.userId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    query = query.eq('user_id', current.userId);
  }

  const offset = (page - 1) * limit;
  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    return Response.json({ error: '목록을 불러오지 못했습니다.' }, { status: 500 });
  }

  return Response.json({
    issues: data ?? [],
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / limit),
  });
}

export async function POST(request: NextRequest) {
  const current = await getCurrentStigma();
  if (!current?.userId) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  const stigmaResult = await db
    .from('stigmas')
    .select('id, user_id, user_name, email, payment_email, role, avatar')
    .eq('user_id', current.userId)
    .maybeSingle();

  const userName = getStigmaDisplayName(stigmaResult.data) || '데브허브 사용자';

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return Response.json({ error: '요청 데이터를 읽지 못했습니다.' }, { status: 400 });
  }

  const title = (formData.get('title') as string)?.trim();
  const category = (formData.get('category') as string)?.trim() as LabsCategory;
  let content = (formData.get('content') as string)?.trim() || '';

  if (!title) {
    return Response.json({ error: '제목을 입력해 주세요.' }, { status: 400 });
  }

  if (!category || !isLabsCategory(category)) {
    return Response.json({ error: '유효한 카테고리를 선택해 주세요.' }, { status: 400 });
  }

  if (!content) {
    return Response.json({ error: '내용을 입력해 주세요.' }, { status: 400 });
  }

  // 1. Validate images
  const imageFiles = formData
    .getAll('images')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  for (const file of imageFiles) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return Response.json({ error: `지원하지 않는 이미지 형식입니다: ${file.name}` }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return Response.json({ error: `이미지 하나당 최대 1MB 이하여야 합니다: ${file.name}` }, { status: 400 });
    }
  }

  const placeholderMapStr = formData.get('placeholderMap') as string;
  let placeholderMap: Record<string, string> = {};
  if (placeholderMapStr) {
    try {
      placeholderMap = JSON.parse(placeholderMapStr);
    } catch {
      // ignore parse error
    }
  }

  try {
    // 2. Create initial GitHub Issue
    const gitHubIssue = await createGitHubIssue({
      title,
      body: content,
      category,
      status: '미확인',
    });

    const issueNumber = gitHubIssue.number;

    // 3. Upload images to GitHub repo: issues/{issueNumber}/{filename}
    let hasReplacedImages = false;
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `${Date.now()}_${i}.${ext}`;

      const uploaded = await uploadGitHubImage({
        issueNumber,
        fileName,
        buffer,
      });

      // Find if client provided placeholder
      const originalName = file.name;
      const placeholder = placeholderMap[originalName] || placeholderMap[String(i)];

      if (placeholder && content.includes(placeholder)) {
        content = content.replaceAll(placeholder, uploaded.rawUrl);
        hasReplacedImages = true;
      } else {
        // Append image to content if not in placeholder
        content += `\n\n![${originalName}](${uploaded.rawUrl})`;
        hasReplacedImages = true;
      }
    }

    // 4. Update GitHub Issue body if images were uploaded
    if (hasReplacedImages) {
      await updateGitHubIssue({
        issueNumber,
        body: content,
      });
    }

    // 5. Save to Supabase
    const { error: dbError } = await db.from('concierge_labs_issues').insert({
      github_issue_number: issueNumber,
      user_id: current.userId,
      user_name: userName,
      category,
      status: '미확인',
      title,
    });

    if (dbError) {
      console.error('Supabase insert failed:', dbError);
    }

    return Response.json({
      ok: true,
      issueNumber,
      title,
    });
  } catch (error) {
    console.error('Issue create error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : '이슈 등록에 실패했습니다.' },
      { status: 500 },
    );
  }
}
