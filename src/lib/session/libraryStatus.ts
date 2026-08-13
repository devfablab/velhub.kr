import { getSupabaseAdmin } from '@/lib/supabase';
import { getMembershipFeatures } from '@/lib/memberships/features';

export async function getLibraryStatus(stigmaId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const identityResult = await supabaseAdmin
    .from('chorogons')
    .select('id')
    .eq('user_id', stigmaId)
    .maybeSingle();

  if (identityResult.error || !identityResult.data) {
    return { isAuthor: false, handleName: null, hasAffettoMyPosts: false };
  }

  const [banqueResult, creatorResult, features] = await Promise.all([
    supabaseAdmin
      .from('chorogons_banque')
      .select('is_author')
      .eq('chorogon_id', identityResult.data.id)
      .maybeSingle(),
    supabaseAdmin
      .from('creators')
      .select('handle_name')
      .eq('user_id', stigmaId)
      .maybeSingle(),
    getMembershipFeatures(stigmaId),
  ]);

  return {
    isAuthor: Boolean(banqueResult.data?.is_author),
    handleName: creatorResult.data?.handle_name ?? null,
    hasAffettoMyPosts: features.has('affetto_my_posts'),
  };
}
