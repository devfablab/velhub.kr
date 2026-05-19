import crypto from 'crypto';
import path from 'path';
import sharp from 'sharp';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

const SITE_LOGO_BUCKET = 'site-logo';
const MAX_FILE_SIZE = 100 * 1024;

function getExtension(fileName: string) {
  return path.extname(fileName).toLowerCase();
}

function isAllowedLogoFile(file: File) {
  const extension = getExtension(file.name);

  if (extension === '.png' && file.type === 'image/png') {
    return true;
  }

  if (extension === '.webp' && file.type === 'image/webp') {
    return true;
  }

  if (extension === '.svg' && file.type === 'image/svg+xml') {
    return true;
  }

  return false;
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

    if (!isAllowedLogoFile(file)) {
      return Response.json({ error: 'PNG, WEBP, SVG 파일만 업로드할 수 있습니다.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: '사이트 로고는 최대 100KB까지 업로드할 수 있습니다.' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const extension = getExtension(file.name);

    let uploadBuffer: Buffer<ArrayBufferLike> = fileBuffer;
    let contentType = file.type;
    let filePath = `${crypto.randomUUID()}${extension}`;

    if (extension === '.png') {
      uploadBuffer = await sharp(fileBuffer).webp({ lossless: true }).toBuffer();
      contentType = 'image/webp';
      filePath = `${crypto.randomUUID()}.webp`;
    }

    const supabaseAdmin = getSupabaseAdmin();

    const uploadResult = await supabaseAdmin.storage.from(SITE_LOGO_BUCKET).upload(filePath, uploadBuffer, {
      contentType,
      upsert: false,
    });

    if (uploadResult.error) {
      return Response.json({ error: '사이트 로고 업로드에 실패했습니다.' }, { status: 500 });
    }

    const publicUrlResult = supabaseAdmin.storage.from(SITE_LOGO_BUCKET).getPublicUrl(filePath);

    return Response.json({
      ok: true,
      logo: filePath,
      path: filePath,
      url: publicUrlResult.data.publicUrl ?? '',
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '사이트 로고 업로드에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '사이트 로고 업로드에 실패했습니다.' }, { status: 500 });
  }
}
