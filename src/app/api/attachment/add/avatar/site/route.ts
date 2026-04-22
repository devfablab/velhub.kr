import path from 'path';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

const AVATAR_BUCKET = 'avatar';

function getSafeExtension(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();

  if (!extension) {
    return '.bin';
  }

  return extension;
}

function getSafeMimeType(fileType: string) {
  if (!fileType) {
    return 'application/octet-stream';
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

    if (!file.type.startsWith('image/')) {
      return Response.json({ error: '이미지 파일만 업로드할 수 있습니다.' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const extension = getSafeExtension(file.name);
    const filePath = `site/${sessionClaims.userId}/${Date.now()}${extension}`;

    const supabaseAdmin = getSupabaseAdmin();

    const uploadResult = await supabaseAdmin.storage.from(AVATAR_BUCKET).upload(filePath, fileBuffer, {
      contentType: getSafeMimeType(file.type),
      upsert: false,
    });

    if (uploadResult.error) {
      console.error('site avatar upload 실패:', uploadResult.error);
      return Response.json({ error: uploadResult.error.message || '스토리지 업로드에 실패했습니다.' }, { status: 500 });
    }

    const publicUrlResult = supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);

    return Response.json({
      ok: true,
      path: filePath,
      url: publicUrlResult.data.publicUrl ?? '',
      avatar: filePath,
    });
  } catch (unknownError) {
    console.error('site avatar upload 예외:', unknownError);

    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '사이트 아바타 업로드에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '사이트 아바타 업로드에 실패했습니다.' }, { status: 500 });
  }
}
