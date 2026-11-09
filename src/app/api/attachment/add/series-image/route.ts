import crypto from 'crypto';
import sharp from 'sharp';
import { r2Storage } from '@/lib/clients/r2Storage';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { getSessionClaims } from '@/lib/session/server';

const MAX_FILE_SIZE = 1024 * 1024;

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return Response.json({ error: '파일이 유효하지 않습니다.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: '연재 이미지는 1MB 이하만 업로드할 수 있습니다.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const filePath = `${crypto.randomUUID()}.webp`;

    const convertedBuffer = await sharp(fileBuffer).webp({ lossless: true }).toBuffer();
    const convertedMetadata = await sharp(convertedBuffer).metadata();

    const supabaseAdmin = getSupabaseAdmin();

    const uploadResult = await r2Storage.from('series').upload(filePath, convertedBuffer, {
      contentType: 'image/webp',
      upsert: false,
    });

    if (uploadResult.error) {
      return Response.json({ error: '연재 이미지 업로드에 실패했습니다.' }, { status: 500 });
    }

    const publicUrlResult = r2Storage.from('series').getPublicUrl(filePath);

    return Response.json({
      ok: true,
      thumbnailImage: filePath,
      url: publicUrlResult.data.publicUrl ?? '',
      width: convertedMetadata.width ?? null,
      height: convertedMetadata.height ?? null,
    });
  } catch {
    return Response.json({ error: '연재 이미지 업로드에 실패했습니다.' }, { status: 500 });
  }
}
