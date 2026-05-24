import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type PageProps = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { siteName } = await params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();

  if (!normalizedSiteName) {
    redirect('/');
  }

  const supabaseAdmin = getSupabaseAdmin();

  const siteInfo = await supabaseAdmin
    .from('rhizomes')
    .select('site_type')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (siteInfo.error || !siteInfo.data?.site_type) {
    redirect(`/${normalizedSiteName}`);
  }

  if (siteInfo.data.site_type === 'blog') {
    redirect(`/${normalizedSiteName}/manage/design/blog/fonts`);
  }

  redirect(`/${normalizedSiteName}/manage/design/community/home`);
}
