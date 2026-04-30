import sharp from 'sharp';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type AllowedFolder = 'thumbnail' | 'images' | 'editor';

const POST_BUCKET = 'post';
const MAX_FILE_SIZE = 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function isAllowedFolder(value: string): value is AllowedFolder {
  return value === 'thumbnail' || value === 'images' || value === 'editor';
}

function getExtensionlessFilePath(userId: string, folder: AllowedFolder) {
  return `${folder}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.webp`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const file = formData.get('file');
    const rawFolder = formData.get('folder');
    const rawSiteName = formData.get('siteName');

    const folder = typeof rawFolder === 'string' ? normalizeText(rawFolder) : '';
    const siteName = typeof rawSiteName === 'string' ? normalizeText(rawSiteName).toLowerCase() : '';

    if (!(file instanceof File)) {
      return Response.json({ error: '이미지 파일이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!isAllowedFolder(folder)) {
      return Response.json({ error: 'folder가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return Response.json({ error: 'png, jpg, webp 이미지만 업로드할 수 있습니다.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: '이미지는 1MB 이하만 업로드할 수 있습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (!session.authUserId || (session.case !== 'staff' && session.case !== 'member')) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    const sharpImage = sharp(inputBuffer);
    const metadata = await sharpImage.metadata();

    const outputBuffer = await sharpImage.webp({ quality: 90 }).toBuffer();
    const outputMetadata = await sharp(outputBuffer).metadata();

    const storagePath = getExtensionlessFilePath(session.authUserId, folder);

    const uploadResult = await supabaseAdmin.storage.from(POST_BUCKET).upload(storagePath, outputBuffer, {
      contentType: 'image/webp',
      upsert: false,
    });

    if (uploadResult.error) {
      return Response.json({ error: '이미지 업로드에 실패했습니다.' }, { status: 500 });
    }

    const publicUrlResult = supabaseAdmin.storage.from(POST_BUCKET).getPublicUrl(storagePath);

    return Response.json({
      ok: true,
      path: storagePath,
      url: publicUrlResult.data.publicUrl ?? '',
      width: outputMetadata.width ?? metadata.width ?? null,
      height: outputMetadata.height ?? metadata.height ?? null,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '이미지 업로드에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '이미지 업로드에 실패했습니다.' }, { status: 500 });
  }
}
