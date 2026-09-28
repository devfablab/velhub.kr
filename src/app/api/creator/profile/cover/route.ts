import { NextResponse } from 'next/server';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

const MAX_FILE_SIZE = 1024 * 1024;
const COVER_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export async function POST(request: Request) {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  const value = formData?.get('file');
  const file = value instanceof File ? value : null;

  if (!file) return NextResponse.json({ message: '파일이 없습니다.' }, { status: 400 });
  if (!COVER_IMAGE_TYPES.includes(file.type))
    return NextResponse.json({ message: 'PNG, JPG, WEBP 이미지만 등록할 수 있습니다.' }, { status: 400 });
  if (file.size <= 0 || file.size >= MAX_FILE_SIZE)
    return NextResponse.json({ message: '이미지는 1MB 미만이어야 합니다.' }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin();
  const uploadedPath = `creator/${crypto.randomUUID()}.webp`;
  const upload = await supabaseAdmin.storage
    .from('cover-image')
    .upload(uploadedPath, file, { contentType: file.type, upsert: false });

  if (upload.error) {
    return NextResponse.json({ message: '이미지를 업로드하지 못했습니다.' }, { status: 500 });
  }

  const publicUrl = supabaseAdmin.storage.from('cover-image').getPublicUrl(uploadedPath).data.publicUrl;

  return NextResponse.json({ url: publicUrl });
}
