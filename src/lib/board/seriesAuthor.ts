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
