import crypto from 'crypto';
import sharp from 'sharp';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

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

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const filePath = `${crypto.randomUUID()}.webp`;

    const convertedBuffer = await sharp(fileBuffer).webp({ lossless: true }).toBuffer();

    const supabaseAdmin = getSupabaseAdmin();

    const uploadResult = await supabaseAdmin.storage.from('og-image').upload(filePath, convertedBuffer, {
      contentType: 'image/webp',
      upsert: false,
    });

    if (uploadResult.error) {
      return Response.json({ error: '오픈그래프 이미지 업로드에 실패했습니다.' }, { status: 500 });
    }

    const publicUrlResult = supabaseAdmin.storage.from('og-image').getPublicUrl(filePath);

    return Response.json({
      ok: true,
      ogImage: filePath,
      url: publicUrlResult.data.publicUrl ?? '',
    });
  } catch {
    return Response.json({ error: '오픈그래프 이미지 업로드에 실패했습니다.' }, { status: 500 });
  }
}
