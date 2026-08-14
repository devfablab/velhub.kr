import { type NextRequest,NextResponse } from 'next/server';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function PUT(request: NextRequest) {
  const currentStigma = await getCurrentStigma();

  if (!currentStigma) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let updates: { id: string; folder_id: string | null; sort_order: number }[] = [];
  try {
    const body = await request.json();
    updates = body.updates;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'Updates array is required' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Validate ownership for all items
  const ids = updates.map((u) => u.id);
  const { data: validItems, error: checkError } = await supabaseAdmin
    .from('blog_favorites')
    .select('id')
    .in('id', ids)
    .eq('user_id', currentStigma.stigmaId);

  if (checkError || !validItems || validItems.length !== ids.length) {
    return NextResponse.json({ error: 'One or more items not found or unauthorized' }, { status: 404 });
  }

  // Update in loop (since Supabase JS bulk upsert requires full row or RPC). We can do individual updates.
  // Or we can use upsert if we know all columns, but we don't.
  // For safety, let's update one by one. If it's a large list, it might be slow, but usually it's small.
  const promises = updates.map((update) =>
    supabaseAdmin
      .from('blog_favorites')
      .update({
        folder_id: update.folder_id,
        sort_order: update.sort_order,
      })
      .eq('id', update.id),
  );

  await Promise.all(promises);

  return NextResponse.json({ ok: true });
}
