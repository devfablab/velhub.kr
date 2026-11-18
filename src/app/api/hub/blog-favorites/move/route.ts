import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { canUseFavoriteFolders, getFavoriteFolders } from '@/lib/service/hubFavoriteFolder.server';
import { getCurrentStigma } from '@/lib/session/utils';

type FavoriteUpdate = { id: string; folder_id: string; sort_order: number };

function isFavoriteUpdate(value: unknown): value is FavoriteUpdate {
  if (!value || typeof value !== 'object') return false;

  const update = value as Record<string, unknown>;

  return (
    typeof update.id === 'string' &&
    typeof update.folder_id === 'string' &&
    typeof update.sort_order === 'number' &&
    Number.isInteger(update.sort_order)
  );
}

export async function PUT(request: NextRequest) {
  const currentStigma = await getCurrentStigma();

  if (!currentStigma) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  let updates: unknown = null;

  try {
    const body = await request.json();
    updates = body.updates;
  } catch {
    return NextResponse.json({ error: '요청 정보를 확인해 주세요.' }, { status: 400 });
  }

  if (!Array.isArray(updates) || updates.length === 0 || !updates.every(isFavoriteUpdate)) {
    return NextResponse.json({ error: '요청 정보를 확인해 주세요.' }, { status: 400 });
  }

  const canUseFolders = await canUseFavoriteFolders(currentStigma.stigmaId);

  if (canUseFolders === null) {
    return NextResponse.json({ error: '멤버십 정보를 확인하지 못했습니다.' }, { status: 500 });
  }

  if (!canUseFolders) {
    return NextResponse.json({ error: '즐겨찾기 편집은 아페토 멤버십 전용 기능입니다.' }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const favoriteIds = updates.map((update) => update.id);

  try {
    const [folders, favoritesResult] = await Promise.all([
      getFavoriteFolders(currentStigma.stigmaId),
      supabaseAdmin.from('blog_favorites').select('id').in('id', favoriteIds).eq('user_id', currentStigma.stigmaId),
    ]);
    const folderIds = new Set(folders.map((folder) => folder.id));

    if (favoritesResult.error || (favoritesResult.data ?? []).length !== new Set(favoriteIds).size) {
      return NextResponse.json({ error: '즐겨찾기를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (updates.some((update) => !folderIds.has(update.folder_id))) {
      return NextResponse.json({ error: '폴더를 찾을 수 없습니다.' }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ error: '즐겨찾기를 확인하지 못했습니다.' }, { status: 500 });
  }

  const results = await Promise.all(
    updates.map((update) =>
      supabaseAdmin
        .from('blog_favorites')
        .update({ folder_id: update.folder_id, sort_order: update.sort_order })
        .eq('id', update.id)
        .eq('user_id', currentStigma.stigmaId),
    ),
  );

  if (results.some((result) => result.error)) {
    return NextResponse.json({ error: '즐겨찾기 순서를 저장하지 못했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
