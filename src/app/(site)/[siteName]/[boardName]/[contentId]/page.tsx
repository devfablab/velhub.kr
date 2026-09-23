import { notFound } from 'next/navigation';
import { getPostPageMetadata } from '@/lib/seoSite';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import type { CommentsResponse } from '@/components/comments/CommentList';
import type { SubscriptionStatusResponse } from '@/components/service/common/SubscriptionButton';
import type { BoardPostCountResponse } from '@/components/service/community/BoardPostCountTableList';
import type { BoardRecentResponse } from '@/components/service/community/BoardRecentTableList';
import { getSiteApiData } from '../../../getSiteApiData';
import Opt, { type ContentResponse, type PollResponse } from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
    boardName: string;
    contentId: string;
  }>;
};

type SearchContext = RouteContext & {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(context: RouteContext) {
  const { siteName, boardName, contentId } = await context.params;

  return getPostPageMetadata({
    siteName,
    boardName,
    contentId,
    pagePath: `/${boardName}/${contentId}`,
  });
}

export default async function Page(context: SearchContext) {
  const { siteName, boardName, contentId } = await context.params;
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
  const queryParams = new URLSearchParams({ siteName: normalizedSiteName });
  if (typeof searchParams.categoryName === 'string' && searchParams.categoryName)
    queryParams.set('categoryName', searchParams.categoryName);
  if (typeof searchParams.seriesName === 'string' && searchParams.seriesName)
    queryParams.set('seriesName', searchParams.seriesName);
  const initial = await getSiteApiData<ContentResponse>(
    `/api/boards/${boardName.toLowerCase()}/${contentId}?${queryParams.toString()}`,
    '게시글 정보를 불러오지 못했습니다.',
  );
  const initialComments = await getSiteApiData<CommentsResponse>(
    `/api/boards/${boardName.toLowerCase()}/${contentId}/comments?siteName=${normalizedSiteName}`,
    '댓글 목록을 불러오지 못했습니다.',
  );
  const [initialPopularPosts, initialRecentPosts] = await Promise.all([
    getSiteApiData<BoardPostCountResponse>(
      `/api/boards/${boardName.toLowerCase()}?siteName=${normalizedSiteName}&page=1&size=10&sort=post_count&includePin=false`,
      '인기글을 불러오지 못했습니다.',
    ),
    getSiteApiData<BoardRecentResponse>(
      `/api/boards/${boardName.toLowerCase()}?siteName=${normalizedSiteName}&page=1&size=10&includePin=false`,
      '최신글을 불러오지 못했습니다.',
    ),
  ]);
  const initialPoll = initial.data?.content?.poll
    ? await getSiteApiData<PollResponse>(
        `/api/boards/${boardName.toLowerCase()}/${contentId}/poll?siteName=${normalizedSiteName}`,
        '투표 정보를 불러오지 못했습니다.',
      )
    : { data: null, error: '' };
  const initialSubscriptionStatus = initial.data?.series
    ? await getSiteApiData<SubscriptionStatusResponse>(
        `/api/payments/portone/subscriptions/status?${new URLSearchParams({
          siteName: normalizedSiteName,
          boardName: boardName.toLowerCase(),
          targetType: 'series',
          seriesName: initial.data.series.series_key,
        }).toString()}`,
        '구독 상태를 확인하지 못했습니다.',
      )
    : { data: null, error: '' };

  return (
    <Opt
      isCommunity={isCommunity}
      initialData={initial.data}
      initialError={initial.error}
      initialComments={initialComments.data}
      initialPopularPosts={initialPopularPosts.data}
      initialRecentPosts={initialRecentPosts.data}
      initialPoll={initialPoll.data}
      initialPollError={initialPoll.error}
      initialSubscriptionStatus={initialSubscriptionStatus.data}
    />
  );
}
