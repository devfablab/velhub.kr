import { NextResponse } from 'next/server';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file') as File | null;

  if (!file) return NextResponse.json({ message: '파일이 없습니다.' }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin();
  const uploadedPath = `user/${crypto.randomUUID()}.webp`;
  const upload = await supabaseAdmin.storage
    .from('cover-image')
    .upload(uploadedPath, file, { contentType: file.type, upsert: false });

  if (upload.error) {
    return NextResponse.json({ message: '이미지를 업로드하지 못했습니다.' }, { status: 500 });
  }

  const publicUrl = supabaseAdmin.storage.from('cover-image').getPublicUrl(uploadedPath).data.publicUrl;

  return NextResponse.json({ url: publicUrl });
}
