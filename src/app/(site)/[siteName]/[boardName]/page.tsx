import { notFound } from 'next/navigation';
import { getBoardPageMetadata } from '@/lib/seoSite';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import type { DonationStatusResponse } from '@/components/service/common/DonationButton';
import type { SubscriptionStatusResponse } from '@/components/service/common/SubscriptionButton';
import type { BoardPostCountResponse } from '@/components/service/community/BoardPostCountTableList';
import { getSiteApiData } from '../../getSiteApiData';
import Opt, { type BoardListResponse } from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
    boardName: string;
  }>;
};

type SearchContext = RouteContext & {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(context: RouteContext) {
  const { siteName, boardName } = await context.params;

  return getBoardPageMetadata({
    siteName,
    boardName,
    pagePath: `/${boardName}`,
  });
}

export default async function Page(context: SearchContext) {
  const { siteName, boardName } = await context.params;
  const searchParams = await context.searchParams;
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

  const queryParams = new URLSearchParams({
    siteName: normalizedSiteName,
    page: typeof searchParams.page === 'string' ? searchParams.page : '1',
    size: boardName.toLowerCase() === 'b' ? '9' : '20',
  });
  if (typeof searchParams.keyword === 'string' && searchParams.keyword)
    queryParams.set('keyword', searchParams.keyword);
  if (typeof searchParams.seriesName === 'string' && searchParams.seriesName)
    queryParams.set('seriesName', searchParams.seriesName);
  const initial = await getSiteApiData<BoardListResponse>(
    `/api/boards/${boardName.toLowerCase()}?${queryParams.toString()}`,
    '전체 게시글을 불러오지 못했습니다.',
  );
  const initialPopularPosts = await getSiteApiData<BoardPostCountResponse>(
    `/api/boards/${boardName.toLowerCase()}?siteName=${normalizedSiteName}&page=1&size=10&sort=post_count&includePin=false`,
    '인기글을 불러오지 못했습니다.',
  );
  const selectedSeries = initial.data?.selectedSeries;
  const initialSubscriptionStatus = selectedSeries
    ? await getSiteApiData<SubscriptionStatusResponse>(
        `/api/payments/portone/subscriptions/status?${new URLSearchParams({
          siteName: normalizedSiteName,
          boardName: boardName.toLowerCase(),
          targetType: 'series',
          seriesName: selectedSeries.series_key,
        }).toString()}`,
        '구독 상태를 확인하지 못했습니다.',
      )
    : { data: null, error: '' };
  const initialDonationStatus = selectedSeries
    ? await getSiteApiData<DonationStatusResponse>(
        `/api/payments/portone/donation/status?${new URLSearchParams({
          siteName: normalizedSiteName,
          boardName: boardName.toLowerCase(),
          targetType: 'series',
          seriesName: selectedSeries.series_key,
        }).toString()}`,
        '후원 상태를 확인하지 못했습니다.',
      )
    : { data: null, error: '' };

  return (
    <Opt
      isCommunity={isCommunity}
      initialData={initial.data}
      initialError={initial.error}
      initialPopularPosts={initialPopularPosts.data}
      initialSubscriptionStatus={initialSubscriptionStatus.data}
      initialDonationStatus={initialDonationStatus.data}
    />
  );
}
