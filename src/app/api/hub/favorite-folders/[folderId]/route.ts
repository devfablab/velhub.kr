import { type NextRequest,NextResponse } from 'next/server';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ folderId: string }> }) {
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

  // Validate ownership
  const folderId = (await params).folderId;
  const { data: folder, error: checkError } = await supabaseAdmin
    .from('favorite_folders')
    .select('id')
    .eq('id', folderId)
    .eq('user_id', currentStigma.stigmaId)
    .single();

  if (checkError || !folder) {
    return NextResponse.json({ error: 'Folder not found or unauthorized' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('favorite_folders')
    .update({ label: label.trim() })
    .eq('id', folderId)
    .select('id, label, is_default, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
  }

  return NextResponse.json({ folder: data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ folderId: string }> }) {
  const currentStigma = await getCurrentStigma();

  if (!currentStigma) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const folderId = (await params).folderId;
  // Validate ownership
  const { data: folder, error: checkError } = await supabaseAdmin
    .from('favorite_folders')
    .select('id, is_default')
    .eq('id', folderId)
    .eq('user_id', currentStigma.stigmaId)
    .single();

  if (checkError || !folder) {
    return NextResponse.json({ error: 'Folder not found or unauthorized' }, { status: 404 });
  }

  // Delete the folder. ON DELETE SET NULL will handle moving items to the default folder.
  const { error } = await supabaseAdmin.from('favorite_folders').delete().eq('id', folderId);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
