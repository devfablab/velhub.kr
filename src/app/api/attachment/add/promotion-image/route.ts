import crypto from 'crypto';
import sharp from 'sharp';
import {
  getSitePromotionAccess,
  MAX_SITE_PROMOTION_FILE_SIZE,
  SITE_PROMOTION_BUCKET,
  SITE_PROMOTION_IMAGE_TYPES,
} from '@/lib/service/sitePromotionImage';
import { normalizeText } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const rawSiteName = formData.get('siteName');
    const siteName = normalizeText(typeof rawSiteName === 'string' ? rawSiteName : '').toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getSitePromotionAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    if (!(file instanceof File)) {
      return Response.json({ error: '업로드할 이미지가 없습니다.' }, { status: 400 });
    }

    if (!SITE_PROMOTION_IMAGE_TYPES.has(file.type.toLowerCase())) {
      return Response.json({ error: 'PNG, JPEG, WEBP 이미지만 업로드할 수 있습니다.' }, { status: 400 });
    }

    if (file.size >= MAX_SITE_PROMOTION_FILE_SIZE) {
      return Response.json({ error: '프로모션 이미지는 1MB 미만만 업로드할 수 있습니다.' }, { status: 400 });
    }

    let outputBuffer: Buffer;

    try {
      const image = sharp(Buffer.from(await file.arrayBuffer())).resize(358, 170, {
        fit: 'cover',
        position: 'centre',
      });

      outputBuffer =
        file.type.toLowerCase() === 'image/webp'
          ? await image.toBuffer()
          : await image.webp({ quality: 90 }).toBuffer();
    } catch {
      return Response.json({ error: '이미지 파일이 올바르지 않습니다.' }, { status: 400 });
    }

    const storagePath = `${access.siteId}/${crypto.randomUUID()}.webp`;
    const uploadResult = await access.supabaseAdmin.storage
      .from(SITE_PROMOTION_BUCKET)
      .upload(storagePath, outputBuffer, {
        contentType: 'image/webp',
        upsert: false,
      });

    if (uploadResult.error) {
      return Response.json({ error: '프로모션 이미지 업로드에 실패했습니다.' }, { status: 500 });
    }

    const publicUrl = access.supabaseAdmin.storage.from(SITE_PROMOTION_BUCKET).getPublicUrl(storagePath);

    return Response.json({ ok: true, path: storagePath, url: publicUrl.data.publicUrl ?? '' });
  } catch (unknownError) {
    return Response.json(
      {
        error:
          unknownError instanceof Error
            ? unknownError.message || '프로모션 이미지 업로드에 실패했습니다.'
            : '프로모션 이미지 업로드에 실패했습니다.',
      },
      { status: 500 },
    );
  }
}
