import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { getMembershipFeatures } from '@/lib/memberships/features';

export async function syncFavoriteFolderAccess(stigmaId: string) {
  const features = await getMembershipFeatures(stigmaId).catch(() => null);

  if (!features) {
    return null;
  }

  const canUseFolders = features.has('affetto_favorite_folders');

  if (!canUseFolders) {
    const moveResult = await getSupabaseAdmin()
      .from('blog_favorites')
      .update({ folder_id: null })
      .eq('user_id', stigmaId)
      .not('folder_id', 'is', null);

    if (moveResult.error) {
      throw new Error('즐겨찾기 폴더를 정리하지 못했습니다.');
    }
  }

  return canUseFolders;
}
