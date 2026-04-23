import path from 'path';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

const COMMUNITY_ANSWER_BUCKET = 'community_answer';
const ALLOWED_MIME_TYPES = ['image/webp', 'image/jpeg', 'image/png'];
const ALLOWED_EXTENSIONS = ['.webp', '.jpg', '.jpeg', '.png'];

function getSafeExtension(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();

  if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
    return '';
  }

  return extension === '.jpeg' ? '.jpg' : extension;
}

function getSafeMimeType(fileType: string) {
  if (!ALLOWED_MIME_TYPES.includes(fileType)) {
    return '';
  }

  return fileType;
}

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return Response.json({ error: '업로드할 파일이 없습니다.' }, { status: 400 });
    }

    const safeMimeType = getSafeMimeType(file.type);
    const safeExtension = getSafeExtension(file.name);

    if (!safeMimeType || !safeExtension) {
      return Response.json({ error: 'webp, jpg, png 파일만 업로드할 수 있습니다.' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const filePath = `${sessionClaims.userId}/${Date.now()}${safeExtension}`;

    const supabaseAdmin = getSupabaseAdmin();

    const uploadResult = await supabaseAdmin.storage.from(COMMUNITY_ANSWER_BUCKET).upload(filePath, fileBuffer, {
      contentType: safeMimeType,
      upsert: false,
    });

    if (uploadResult.error) {
      return Response.json({ error: uploadResult.error.message || '이미지 업로드에 실패했습니다.' }, { status: 500 });
    }

    const publicUrlResult = supabaseAdmin.storage.from(COMMUNITY_ANSWER_BUCKET).getPublicUrl(filePath);

    return Response.json({
      ok: true,
      answerImage: filePath,
      url: publicUrlResult.data.publicUrl ?? '',
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '이미지 업로드에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '이미지 업로드에 실패했습니다.' }, { status: 500 });
  }
}
