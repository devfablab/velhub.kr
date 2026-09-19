import { cache, type ReactNode, Suspense } from 'react';
import type { Metadata } from 'next';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import SiteGoogleAnalytics from '@/components/service/common/SiteGoogleAnalytics';
import HeaderSite from '@/components/headers/Site';
import { getSiteApiData } from '../getSiteApiData';
import { SiteHeaderProvider, type SiteHeaderData } from './SiteHeaderContext';
import { SiteInitialDataProvider } from './SiteInitialDataContext';

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
  const header = await getSiteApiData<SiteHeaderData>(`/api/header/site?siteName=${encodeURIComponent(siteName)}`, '사이트 정보를 불러오지 못했습니다.');
  const [boards, writeBoards, postCounts, communitySiteInfo, communityLinks, communityUserInfo, blogProfile, siteMenu] = await Promise.all([
    getSiteApiData<{ boards?: Array<{ id: string; board_key: string; board_label: string; board_type: 'blog' | 'page' | 'basic' | 'gallery' | 'youtube' | 'feed'; is_active: boolean }> }>(`/api/boards?siteName=${encodeURIComponent(siteName)}`, '게시판 목록을 불러오지 못했습니다.'),
    getSiteApiData<{ boards?: Array<{ id: string; board_key: string; board_label: string; board_type: 'blog' | 'page' | 'basic' | 'gallery' | 'youtube' | 'feed'; is_active: boolean }> }>(`/api/boards/write?siteName=${encodeURIComponent(siteName)}`, '글쓰기 게시판을 불러오지 못했습니다.'),
    getSiteApiData<{ contents?: Array<{ id: string; slug: string; subject: string; board_key: string; post_count: number; comment_count: number }> }>(`/api/boards/all?siteName=${encodeURIComponent(siteName)}&page=1&size=10&sort=post_count&includePin=false`, '인기글을 불러오지 못했습니다.'),
    header.data?.siteType === 'community' ? getSiteApiData<{ siteInfo?: unknown }>(`/api/site/community?siteName=${encodeURIComponent(siteName)}`, '커뮤니티 정보를 불러오지 못했습니다.') : Promise.resolve({ data: null }),
    header.data?.siteType === 'community' ? getSiteApiData<{ links?: unknown[] }>(`/api/manage/design/community/links?siteName=${encodeURIComponent(siteName)}`, '커뮤니티 링크를 불러오지 못했습니다.') : Promise.resolve({ data: null }),
    header.data?.siteType === 'community' ? getSiteApiData<unknown>(`/api/users/${encodeURIComponent(siteName)}/me`, '사용자 정보를 불러오지 못했습니다.') : Promise.resolve({ data: null }),
    header.data?.siteType === 'blog' ? getSiteApiData<unknown>(`/api/info/general/site/${encodeURIComponent(siteName)}`, '사이트 정보를 불러오지 못했습니다.') : Promise.resolve({ data: null }),
    getSiteApiData<{ menus?: Array<{ id: string; board_type: string; board_label: string; slug: string; display_label: string; sort_order: number; is_renameable: boolean }>; privateBoard?: { label: string } | null }>(`/api/site/public?siteName=${encodeURIComponent(siteName)}`, '메뉴를 불러오지 못했습니다.'),
  ]);

  return (
    <>
      <SiteHeaderProvider value={header.data}>
        <SiteInitialDataProvider value={{ boards: boards.data?.boards ?? [], writeBoards: writeBoards.data?.boards ?? [], postCountContents: postCounts.data?.contents ?? [], communitySiteInfo: communitySiteInfo.data?.siteInfo ?? null, communityLinks: communityLinks.data?.links ?? [], communityUserInfo: communityUserInfo.data ?? null, blogProfile: blogProfile.data ?? null, siteMenus: siteMenu.data?.menus ?? [], privateBoardLabel: header.data?.siteType === 'community' ? (siteMenu.data?.privateBoard?.label ?? '') : '' }}>
          <HeaderSite />
          {children}
        </SiteInitialDataProvider>
      </SiteHeaderProvider>
      {settings.googleAnalytics ? (
        <Suspense fallback={null}>
          <SiteGoogleAnalytics measurementId={settings.googleAnalytics} />
        </Suspense>
      ) : null}
    </>
  );
}
