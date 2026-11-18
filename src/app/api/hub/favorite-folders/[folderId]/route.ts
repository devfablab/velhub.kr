import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import {
  canUseFavoriteFolders,
  getBottomSortOrderInFolder,
  getFavoriteFolders,
  saveFavoriteFolderOrder,
  toFavoriteFolder,
} from '@/lib/service/hubFavoriteFolder.server';
import { validateFavoriteFolderLabel } from '@/lib/service/hubFavoriteFolder.shared';
import { getCurrentStigma } from '@/lib/session/utils';
import { normalizeText } from '@/lib/utils';

type RouteContext = { params: Promise<{ folderId: string }> };

async function getEditableStigmaId() {
  const currentStigma = await getCurrentStigma();

  if (!currentStigma) {
    return { error: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) };
  }

  const canUseFolders = await canUseFavoriteFolders(currentStigma.stigmaId);

  if (canUseFolders === null) {
    return { error: NextResponse.json({ error: '멤버십 정보를 확인하지 못했습니다.' }, { status: 500 }) };
  }

  if (!canUseFolders) {
    return {
      error: NextResponse.json({ error: '즐겨찾기 폴더 관리는 아페토 멤버십 전용 기능입니다.' }, { status: 403 }),
    };
  }

  return { stigmaId: currentStigma.stigmaId };
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const editable = await getEditableStigmaId();

  if (editable.error) return editable.error;

  let label: unknown = '';

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

  const { folderId } = await params;
  const updateResult = await getSupabaseAdmin()
    .from('favorite_folders')
    .update({ label: validated.label })
    .eq('id', folderId)
    .eq('user_id', editable.stigmaId)
    .select('id, label, is_default, sort_order')
    .maybeSingle();

  if (updateResult.error) {
    return NextResponse.json(
      { error: '폴더 이름을 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    );
  }

  if (!updateResult.data) {
    return NextResponse.json({ error: '요청한 폴더를 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json({ folder: toFavoriteFolder(updateResult.data) });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const editable = await getEditableStigmaId();

  if (editable.error) return editable.error;

  const { folderId } = await params;
  const targetFolderId = normalizeText(new URL(request.url).searchParams.get('targetFolderId'));

  try {
    const folders = await getFavoriteFolders(editable.stigmaId);

    if (!folders.some((folder) => folder.id === folderId)) {
      return NextResponse.json({ error: '요청한 폴더를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (folders.length <= 1) {
      return NextResponse.json({ error: '폴더가 하나뿐이라 삭제할 수 없습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const favoritesResult = await supabaseAdmin
      .from('blog_favorites')
      .select('id, sort_order')
      .eq('user_id', editable.stigmaId)
      .eq('folder_id', folderId)
      .order('sort_order', { ascending: true });

    if (favoritesResult.error) throw new Error('즐겨찾기를 확인하지 못했습니다.');

    const favorites = favoritesResult.data ?? [];

    if (favorites.length > 0) {
      if (!targetFolderId || targetFolderId === folderId || !folders.some((folder) => folder.id === targetFolderId)) {
        return NextResponse.json({ error: '즐겨찾기를 옮길 폴더를 선택해 주세요.' }, { status: 400 });
      }

      const bottomSortOrder = await getBottomSortOrderInFolder(editable.stigmaId, targetFolderId);
      const moveResults = await Promise.all(
        favorites.map((favorite, index) =>
          supabaseAdmin
            .from('blog_favorites')
            .update({ folder_id: targetFolderId, sort_order: bottomSortOrder + index })
            .eq('id', favorite.id)
            .eq('user_id', editable.stigmaId),
        ),
      );

      if (moveResults.some((result) => result.error)) throw new Error('즐겨찾기를 옮기지 못했습니다.');
    }

    const deleteResult = await supabaseAdmin
      .from('favorite_folders')
      .delete()
      .eq('id', folderId)
      .eq('user_id', editable.stigmaId);

    if (deleteResult.error) throw new Error('폴더를 삭제하지 못했습니다.');

    await saveFavoriteFolderOrder(
      editable.stigmaId,
      folders.filter((folder) => folder.id !== folderId).map((folder) => folder.id),
    );

    const nextFolders = await getFavoriteFolders(editable.stigmaId);

    return NextResponse.json({ folders: nextFolders.map(toFavoriteFolder) });
  } catch {
    return NextResponse.json({ error: '폴더를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
