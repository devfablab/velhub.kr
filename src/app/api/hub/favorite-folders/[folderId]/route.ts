import { type NextRequest, NextResponse } from 'next/server';
import { validateFavoriteFolderLabel } from '@/lib/hub/favoriteFolder.shared';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ folderId: string }> }) {
  const currentStigma = await getCurrentStigma();

  if (!currentStigma) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  let label = '';
  try {
    const body = await request.json();
    label = body.label;
  } catch {
    return NextResponse.json({ error: '요청 정보를 확인해 주세요.' }, { status: 400 });
  }

  const validated = validateFavoriteFolderLabel(label);
  if (validated.error) {
    return NextResponse.json({ error: validated.error, fieldErrors: { label: validated.error } }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const folderId = (await params).folderId;
  const { data: folder, error: checkError } = await supabaseAdmin
    .from('favorite_folders')
    .select('id')
    .eq('id', folderId)
    .eq('user_id', currentStigma.stigmaId)
    .single();

  if (checkError || !folder) {
    return NextResponse.json({ error: '요청한 폴더를 찾을 수 없습니다.' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('favorite_folders')
    .update({ label: validated.label })
    .eq('id', folderId)
    .select('id, label, is_default, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: '폴더 이름을 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }

  return NextResponse.json({ folder: data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ folderId: string }> }) {
  const currentStigma = await getCurrentStigma();

  if (!currentStigma) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const folderId = (await params).folderId;

  const { data: folder, error: checkError } = await supabaseAdmin
    .from('favorite_folders')
    .select('id, is_default')
    .eq('id', folderId)
    .eq('user_id', currentStigma.stigmaId)
    .single();

  if (checkError || !folder) {
    return NextResponse.json({ error: '요청한 폴더를 찾을 수 없습니다.' }, { status: 404 });
  }

  const { error } = await supabaseAdmin.from('favorite_folders').delete().eq('id', folderId);

  if (error) {
    return NextResponse.json({ error: '폴더를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
