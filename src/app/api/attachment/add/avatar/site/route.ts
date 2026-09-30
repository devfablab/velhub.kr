import crypto from 'crypto';
import path from 'path';
import sharp from 'sharp';
import { sanitizeSvg } from '@/lib/attachments/sanitizeSvg.server';
import { getSiteOgAccess } from '@/lib/service/siteOgImage';
import { normalizeText } from '@/lib/utils';

const AVATAR_BUCKET = 'avatar';
const MAX_FILE_SIZE = 1024 * 1024;
const RASTER_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function getExtension(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();

  if (!extension) {
    return '';
  }

  return extension;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const rawSiteName = formData.get('siteName');
    const siteName = normalizeText(typeof rawSiteName === 'string' ? rawSiteName : '').toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getSiteOgAccess(siteName);
    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    if (!(file instanceof File)) {
      return Response.json({ error: '업로드할 파일이 없습니다.' }, { status: 400 });
    }

    const extension = getExtension(file.name);
    const isSvg = extension === '.svg' && file.type === 'image/svg+xml';
    const isRaster = RASTER_IMAGE_TYPES.has(file.type.toLowerCase());

    if (!isSvg && !isRaster) {
      return Response.json({ error: 'PNG, JPEG, WEBP, SVG 이미지만 업로드할 수 있습니다.' }, { status: 400 });
    }

    if (file.size >= MAX_FILE_SIZE) {
      return Response.json({ error: '사이트 아바타 이미지는 1MB 미만만 업로드할 수 있습니다.' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    let uploadBuffer: Buffer;
    let contentType: string;
    let outputExtension: string;

    if (isSvg) {
      uploadBuffer = sanitizeSvg(fileBuffer);
      contentType = 'image/svg+xml';
      outputExtension = '.svg';
    } else {
      try {
        uploadBuffer = await sharp(fileBuffer).resize(72, 72, { fit: 'cover', position: 'centre' }).webp({ quality: 90 }).toBuffer();
      } catch {
        return Response.json({ error: '이미지 파일이 올바르지 않습니다.' }, { status: 400 });
      }
      contentType = 'image/webp';
      outputExtension = '.webp';
    }

    const filePath = `site/${access.siteId}/${crypto.randomUUID()}${outputExtension}`;

    const uploadResult = await access.supabaseAdmin.storage.from(AVATAR_BUCKET).upload(filePath, uploadBuffer, {
      contentType,
      upsert: false,
    });

    if (uploadResult.error) {
      console.error('site avatar upload 실패:', uploadResult.error);
      return Response.json({ error: uploadResult.error.message || '스토리지 업로드에 실패했습니다.' }, { status: 500 });
    }

    const publicUrlResult = access.supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);

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
