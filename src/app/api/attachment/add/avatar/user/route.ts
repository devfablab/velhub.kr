import path from 'path';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

const AVATAR_BUCKET = 'avatar';
const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

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

function getDetectedImageMimeType(fileBuffer: Buffer) {
  if (fileBuffer.length >= 3 && fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8 && fileBuffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    fileBuffer.length >= 8 &&
    fileBuffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    fileBuffer.length >= 6 &&
    (fileBuffer.subarray(0, 6).toString() === 'GIF87a' || fileBuffer.subarray(0, 6).toString() === 'GIF89a')
  ) {
    return 'image/gif';
  }
  if (
    fileBuffer.length >= 12 &&
    fileBuffer.subarray(0, 4).toString() === 'RIFF' &&
    fileBuffer.subarray(8, 12).toString() === 'WEBP'
  ) {
    return 'image/webp';
  }
  return '';
}

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return Response.json({ error: '업로드할 파일이 없습니다.' }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_AVATAR_FILE_SIZE) {
      return Response.json({ error: '아바타 이미지는 5MB 이하로 업로드해 주세요.' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const detectedMimeType = getDetectedImageMimeType(fileBuffer);

    if (!detectedMimeType || !IMAGE_EXTENSIONS[detectedMimeType]) {
      return Response.json(
        { error: 'JPG, PNG, GIF, WEBP 형식의 이미지 파일만 업로드할 수 있습니다.' },
        { status: 400 },
      );
    }

    const extension = IMAGE_EXTENSIONS[detectedMimeType] ?? getSafeExtension(file.name);
    const filePath = `${sessionClaims.userId}/${Date.now()}${extension}`;

    const supabaseAdmin = getSupabaseAdmin();

    const uploadResult = await supabaseAdmin.storage.from(AVATAR_BUCKET).upload(filePath, fileBuffer, {
      contentType: getSafeMimeType(detectedMimeType),
      upsert: false,
    });

    if (uploadResult.error) {
      console.error('avatar upload 실패:', uploadResult.error);
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
    console.error('avatar upload 예외:', unknownError);

    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '아바타 업로드에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '아바타 업로드에 실패했습니다.' }, { status: 500 });
  }
}
