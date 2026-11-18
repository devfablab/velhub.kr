import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { getMembershipFeatures } from '@/lib/memberships/features';
import { DEFAULT_FAVORITE_FOLDER_LABEL, type FavoriteFolder } from '@/lib/service/hubFavoriteFolder.shared';

type FolderRow = {
  id: string;
  label: string;
  is_default: boolean;
  sort_order: number;
};

const FOLDER_COLUMNS = 'id, label, is_default, sort_order';

export function toFavoriteFolder(row: FolderRow): FavoriteFolder {
  return { id: row.id, label: row.label, isDefault: row.is_default, sortOrder: row.sort_order };
}

export async function canUseFavoriteFolders(stigmaId: string) {
  const features = await getMembershipFeatures(stigmaId).catch(() => null);

  return features ? features.has('affetto_favorite_folders') : null;
}

export async function getFavoriteFolders(stigmaId: string) {
  const result = await getSupabaseAdmin()
    .from('favorite_folders')
    .select(FOLDER_COLUMNS)
    .eq('user_id', stigmaId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (result.error) throw new Error('즐겨찾기 폴더를 불러오지 못했습니다.');

  return (result.data ?? []) as FolderRow[];
}

export async function saveFavoriteFolderOrder(stigmaId: string, folderIds: string[]) {
  const supabaseAdmin = getSupabaseAdmin();

  const clearResult = await supabaseAdmin
    .from('favorite_folders')
    .update({ is_default: false })
    .eq('user_id', stigmaId)
    .eq('is_default', true);

  if (clearResult.error) throw new Error('폴더 순서를 저장하지 못했습니다.');

  const results = await Promise.all(
    folderIds.map((folderId, index) =>
      supabaseAdmin
        .from('favorite_folders')
        .update({ sort_order: index, is_default: index === 0 })
        .eq('id', folderId)
        .eq('user_id', stigmaId),
    ),
  );

  if (results.some((result) => result.error)) throw new Error('폴더 순서를 저장하지 못했습니다.');
}

export async function ensureDefaultFavoriteFolder(stigmaId: string) {
  const folders = await getFavoriteFolders(stigmaId);
  const defaultFolder = folders.find((folder) => folder.is_default);

  if (defaultFolder && folders[0]?.id === defaultFolder.id) return folders;

  if (folders.length > 0) {
    await saveFavoriteFolderOrder(
      stigmaId,
      folders.map((folder) => folder.id),
    );

    return getFavoriteFolders(stigmaId);
  }

  const insertResult = await getSupabaseAdmin()
    .from('favorite_folders')
    .insert({ user_id: stigmaId, label: DEFAULT_FAVORITE_FOLDER_LABEL, is_default: true, sort_order: 0 });

  if (insertResult.error && insertResult.error.code !== '23505') {
    throw new Error('기본 폴더를 만들지 못했습니다.');
  }

  return getFavoriteFolders(stigmaId);
}

export async function getDefaultFavoriteFolderId(stigmaId: string) {
  const folders = await ensureDefaultFavoriteFolder(stigmaId);
  const defaultFolder = folders.find((folder) => folder.is_default) ?? folders[0];

  if (!defaultFolder) throw new Error('기본 폴더를 찾지 못했습니다.');

  return defaultFolder.id;
}

export async function getTopSortOrderInFolder(stigmaId: string, folderId: string) {
  const result = await getSupabaseAdmin()
    .from('blog_favorites')
    .select('sort_order')
    .eq('user_id', stigmaId)
    .eq('folder_id', folderId)
    .order('sort_order', { ascending: true })
    .limit(1);

  if (result.error) throw new Error('즐겨찾기 순서를 확인하지 못했습니다.');

  const topSortOrder = result.data?.[0]?.sort_order;

  return typeof topSortOrder === 'number' ? topSortOrder - 1 : 0;
}

export async function getBottomSortOrderInFolder(stigmaId: string, folderId: string) {
  const result = await getSupabaseAdmin()
    .from('blog_favorites')
    .select('sort_order')
    .eq('user_id', stigmaId)
    .eq('folder_id', folderId)
    .order('sort_order', { ascending: false })
    .limit(1);

  if (result.error) throw new Error('즐겨찾기 순서를 확인하지 못했습니다.');

  const bottomSortOrder = result.data?.[0]?.sort_order;

  return typeof bottomSortOrder === 'number' ? bottomSortOrder + 1 : 0;
}
