import { cache, type ReactNode,Suspense } from 'react';
import type { Metadata } from 'next';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import SiteGoogleAnalytics from '@/components/service/common/SiteGoogleAnalytics';

type RouteContext = {
  children: ReactNode;
  params: Promise<{
    siteName: string;
  }>;
};

type SiteAdvancedSettings = {
  searchKeywords: string[];
  googleAnalytics: string;
  googleSearch: string;
};

const EMPTY_SETTINGS: SiteAdvancedSettings = {
  searchKeywords: [],
  googleAnalytics: '',
  googleSearch: '',
};

const getSiteAdvancedSettings = cache(async (siteName: string): Promise<SiteAdvancedSettings> => {
  const normalizedSiteName = normalizeText(siteName).toLowerCase();

  if (!normalizedSiteName) {
    return EMPTY_SETTINGS;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const rhizomeResult = await supabaseAdmin
    .from('rhizomes')
    .select('id')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (rhizomeResult.error || !rhizomeResult.data) {
    return EMPTY_SETTINGS;
  }

  const sitesResult = await supabaseAdmin
    .from('sites')
    .select('search_keywords, google_analytics, google_search')
    .eq('site_id', rhizomeResult.data.id)
    .maybeSingle();

  if (sitesResult.error || !sitesResult.data) {
    return EMPTY_SETTINGS;
  }

  const searchKeywords = normalizeText(sitesResult.data.search_keywords)
    .split(',')
    .map((keyword) => normalizeText(keyword))
    .filter(Boolean);

  return {
    searchKeywords,
    googleAnalytics: normalizeText(sitesResult.data.google_analytics),
    googleSearch: normalizeText(sitesResult.data.google_search),
  };
});

export async function generateMetadata({ params }: RouteContext): Promise<Metadata> {
  const { siteName } = await params;
  const settings = await getSiteAdvancedSettings(siteName);

  return {
    keywords: settings.searchKeywords.length > 0 ? settings.searchKeywords : undefined,
    verification: settings.googleSearch
      ? {
          google: settings.googleSearch,
        }
      : undefined,
  };
}

export default async function SiteLayout({ children, params }: RouteContext) {
  const { siteName } = await params;
  const settings = await getSiteAdvancedSettings(siteName);

  return (
    <>
      {children}
      {settings.googleAnalytics ? (
        <Suspense fallback={null}>
          <SiteGoogleAnalytics measurementId={settings.googleAnalytics} />
        </Suspense>
      ) : null}
    </>
  );
}
