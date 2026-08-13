import { getSupabaseAdmin } from '@/lib/supabase';
import { getMembershipFeatures } from '@/lib/memberships/features';
import { getAuthorState } from '@/lib/session/author';

export async function getLibraryStatus(stigmaId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const [{ isAuthor }, creatorResult, features] = await Promise.all([
    getAuthorState(stigmaId),
    supabaseAdmin.from('creators').select('handle_name').eq('user_id', stigmaId).maybeSingle(),
    getMembershipFeatures(stigmaId),
  ]);

  return {
    isAuthor,
    handleName: creatorResult.data?.handle_name ?? null,
    hasAffettoMyPosts: features.has('affetto_my_posts'),
    hasCreatorLounge: features.has('creator_lounge'),
    hasCreatorPosts: features.has('creator_posts'),
    hasOwnerLounge: features.has('owner_lounge'),
  };
}
