import crypto from 'crypto';
import sharp from 'sharp';
import { getSiteOgAccess, MAX_SITE_OG_FILE_SIZE, SITE_OG_BUCKET, SITE_OG_IMAGE_TYPES } from '@/lib/service/siteOgImage';
import { normalizeText } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const rawSiteName = formData.get('siteName');
    const siteName = typeof rawSiteName === 'string' ? normalizeText(rawSiteName).toLowerCase() : '';

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getSiteOgAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    if (!(file instanceof File)) {
      return Response.json({ error: '업로드할 이미지가 없습니다.' }, { status: 400 });
    }

    if (!SITE_OG_IMAGE_TYPES.has(file.type.toLowerCase())) {
      return Response.json({ error: 'PNG, JPEG, WEBP 이미지만 업로드할 수 있습니다.' }, { status: 400 });
    }

    if (file.size >= MAX_SITE_OG_FILE_SIZE) {
      return Response.json({ error: '오픈그래프 이미지는 1MB 미만만 업로드할 수 있습니다.' }, { status: 400 });
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());
    let outputBuffer: Buffer;

    try {
      outputBuffer = await sharp(inputBuffer)
        .resize(1280, 630, {
          fit: 'cover',
          position: 'centre',
        })
        .webp({ quality: 90 })
        .toBuffer();
    } catch {
      return Response.json({ error: '이미지 파일이 올바르지 않습니다.' }, { status: 400 });
    }

    const storagePath = `${access.siteId}/${crypto.randomUUID()}.webp`;
    const uploadResult = await access.supabaseAdmin.storage.from(SITE_OG_BUCKET).upload(storagePath, outputBuffer, {
      contentType: 'image/webp',
      upsert: false,
    });

    if (uploadResult.error) {
      return Response.json({ error: '오픈그래프 이미지 업로드에 실패했습니다.' }, { status: 500 });
    }

    const publicUrlResult = access.supabaseAdmin.storage.from(SITE_OG_BUCKET).getPublicUrl(storagePath);

    return Response.json({
      ok: true,
      path: storagePath,
      url: publicUrlResult.data.publicUrl ?? '',
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '오픈그래프 이미지 업로드에 실패했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '오픈그래프 이미지 업로드에 실패했습니다.' }, { status: 500 });
  }
}
