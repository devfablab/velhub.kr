import { getMembershipFeatures } from '@/lib/memberships/features';
import { getAuthorState } from '@/lib/session/author';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function getLibraryStatus(stigmaId: string | null) {
  if (!stigmaId) {
    return {
      isAuthor: false,
      creatorHandleName: null,
      userHandleName: null,
      hasAffettoMyPosts: false,
      hasCreatorLounge: false,
    };
  }

  const supabaseAdmin = getSupabaseAdmin();

  const [{ isAuthor }, creatorResult, userResult, features] = await Promise.all([
    getAuthorState(stigmaId),
    supabaseAdmin.from('creators').select('handle_name').eq('user_id', stigmaId).maybeSingle(),
    supabaseAdmin.from('users').select('handle_name').eq('user_id', stigmaId).maybeSingle(),
    getMembershipFeatures(stigmaId),
  ]);

  return {
    isAuthor,
    creatorHandleName: creatorResult.data?.handle_name ?? null,
    userHandleName: userResult.data?.handle_name ?? null,
    hasAffettoMyPosts: features.has('affetto_my_posts'),
    hasCreatorLounge: features.has('creator_lounge'),
    hasCreatorPosts: features.has('creator_posts'),
    hasOwnerLounge: features.has('owner_lounge'),
  };
}
