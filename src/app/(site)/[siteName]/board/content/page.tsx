import { notFound } from 'next/navigation';
import { getPostPageMetadata } from '@/lib/seoSite';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import Opt from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
  searchParams: Promise<{
    boardName?: string;
    contentId?: string;
  }>;
};

export async function generateMetadata(context: RouteContext) {
  const { siteName } = await context.params;
  const { boardName = '', contentId = '' } = await context.searchParams;
  const queryParams = new URLSearchParams({
    boardName,
    contentId,
  });

  return getPostPageMetadata({
    siteName,
    boardName,
    contentId,
    pagePath: `/board/content?${queryParams.toString()}`,
  });
}

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();

  if (!normalizedSiteName) {
    notFound();
  }

  const supabaseAdmin = getSupabaseAdmin();

  const rhizomeResult = await supabaseAdmin
    .from('rhizomes')
    .select('site_type')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (rhizomeResult.error || !rhizomeResult.data) {
    notFound();
  }

  const isCommunity = rhizomeResult.data.site_type === 'community';
  return <Opt isCommunity={isCommunity} />;
}
