import { type NextRequest,NextResponse } from 'next/server';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const currentStigma = await getCurrentStigma();

  if (!currentStigma) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  // 1. Get favorite folders
  const { data: folders, error: foldersError } = await supabaseAdmin
    .from('favorite_folders')
    .select('id, label, is_default, created_at')
    .eq('user_id', currentStigma.stigmaId)
    .order('created_at', { ascending: true });

  if (foldersError) {
    return NextResponse.json({ error: 'Failed to load folders' }, { status: 500 });
  }

  return NextResponse.json({ folders: folders || [] });
}

export async function POST(request: NextRequest) {
  const currentStigma = await getCurrentStigma();

  if (!currentStigma) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let label = '';
  try {
    const body = await request.json();
    label = body.label;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!label || label.trim() === '') {
    return NextResponse.json({ error: 'Folder label is required' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from('favorite_folders')
    .insert({
      user_id: currentStigma.stigmaId,
      label: label.trim(),
      is_default: false,
    })
    .select('id, label, is_default, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }

  return NextResponse.json({ folder: data });
}
