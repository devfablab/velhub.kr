import { type NextRequest, NextResponse } from 'next/server';
import { validateFavoriteFolderLabel } from '@/lib/hub/favoriteFolder.shared';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const currentStigma = await getCurrentStigma();

  if (!currentStigma) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: folders, error: foldersError } = await supabaseAdmin
    .from('favorite_folders')
    .select('id, label, is_default, created_at')
    .eq('user_id', currentStigma.stigmaId)
    .order('created_at', { ascending: true });

  if (foldersError) {
    return NextResponse.json({ error: '즐겨찾기 폴더를 불러오지 못했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ folders: folders || [] });
}

export async function POST(request: NextRequest) {
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

  const { data, error } = await supabaseAdmin
    .from('favorite_folders')
    .insert({
      user_id: currentStigma.stigmaId,
      label: validated.label,
      is_default: false,
    })
    .select('id, label, is_default, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: '폴더를 추가하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }

  return NextResponse.json({ folder: data });
}
