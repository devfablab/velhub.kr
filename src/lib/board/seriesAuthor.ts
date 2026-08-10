import { getSupabaseAdmin } from '@/lib/supabase';

export async function isSoloBlog({
  supabaseAdmin,
  siteId,
  siteType,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  siteId: string;
  siteType: string | null;
}) {
  if (siteType !== 'blog') {
    return false;
  }

  const members = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('is_approval', true)
    .in('role', ['owner', 'member', 'manager']);

  return !members.error && (members.count ?? 0) <= 1;
}

export async function canBeSeriesAuthor({
  supabaseAdmin,
  siteId,
  stigmaId,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  siteId: string;
  stigmaId: string;
}) {
  const [memberResult, identityResult] = await Promise.all([
    supabaseAdmin
      .from('rhizome_stigmas')
      .select('id')
      .eq('site_id', siteId)
      .eq('user_id', stigmaId)
      .eq('is_approval', true)
      .neq('role', 'observer')
      .maybeSingle(),
    supabaseAdmin.from('chorogons').select('id').eq('user_id', stigmaId).maybeSingle(),
  ]);

  if (memberResult.error || !memberResult.data || identityResult.error || !identityResult.data) {
    return false;
  }

  const authorResult = await supabaseAdmin
    .from('chorogons_banque')
    .select('id')
    .eq('chorogon_id', identityResult.data.id)
    .eq('is_author', true)
    .maybeSingle();

  return !authorResult.error && Boolean(authorResult.data);
}
