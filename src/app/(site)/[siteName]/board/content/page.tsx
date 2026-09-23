import { notFound } from 'next/navigation';
import { getPostPageMetadata } from '@/lib/seoSite';
import type { LinkPreviewData } from '@/lib/service/getLinkPreview';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import type { CommentsResponse } from '@/components/comments/CommentList';
import type { SubscriptionStatusResponse } from '@/components/service/common/SubscriptionButton';
import { getSiteApiData } from '../../../getSiteApiData';
import Opt, { type ContentResponse, type PollResponse } from './opt';

type CountResponse = {
  postCount?: number;
};

function extractUrls(value: string) {
  const matchedUrls = value.match(/https?:\/\/[^\s<>"']+/g) ?? [];
  return Array.from(new Set(matchedUrls.map((url) => url.replace(/[),.!?]+$/g, '').trim()).filter(Boolean)));
}

async function getLinkPreviews(contentSimple: string | null | undefined) {
  const urls = contentSimple ? extractUrls(contentSimple) : [];
  const entries = await Promise.all(
    urls.map(async (url) => {
      const result = await getSiteApiData<LinkPreviewData>(
        `/api/link-preview?url=${encodeURIComponent(url)}`,
        '링크 정보를 불러오지 못했습니다.',
      );
      return [url, result.data] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<string, LinkPreviewData | null>;
}

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
  const { boardName = '', contentId = '' } = await context.searchParams;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const normalizedBoardName = normalizeText(boardName).toLowerCase();

  if (!normalizedSiteName || !normalizedBoardName) {
    notFound();
  }

  const supabaseAdmin = getSupabaseAdmin();

  const rhizomeResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_type')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (rhizomeResult.error || !rhizomeResult.data) {
    notFound();
  }

  const isCommunity = rhizomeResult.data.site_type === 'community';

  if (!isCommunity) {
    notFound();
  }

  const boardResult = await supabaseAdmin
    .from('boards')
    .select('board_type')
    .eq('site_id', rhizomeResult.data.id)
    .eq('board_key', normalizedBoardName)
    .maybeSingle();

  if (boardResult.error || !boardResult.data || boardResult.data.board_type === 'page') {
    notFound();
  }

  const initial = await getSiteApiData<ContentResponse>(
    `/api/boards/${normalizedBoardName}/${contentId}?siteName=${normalizedSiteName}`,
    '게시글 정보를 불러오지 못했습니다.',
  );
  if (initial.data?.content?.published_status === 'published') {
    const [countResult] = await Promise.all([
      getSiteApiData<CountResponse>(
        `/api/boards/${normalizedBoardName}/${contentId}/count?siteName=${normalizedSiteName}`,
        '조회수를 반영하지 못했습니다.',
        { method: 'PATCH' },
      ),
      getSiteApiData(
        `/api/boards/${normalizedBoardName}/${contentId}/read?siteName=${normalizedSiteName}`,
        '읽은 글을 기록하지 못했습니다.',
        { method: 'PATCH' },
      ),
    ]);

    if (typeof countResult.data?.postCount === 'number') {
      initial.data.content.post_count = countResult.data.postCount;
    }
  }
  const initialPoll = initial.data?.content?.poll
    ? await getSiteApiData<PollResponse>(
        `/api/boards/${normalizedBoardName}/${contentId}/poll?siteName=${normalizedSiteName}`,
        '투표 정보를 불러오지 못했습니다.',
      )
    : { data: null, error: '' };
  const initialComments = await getSiteApiData<CommentsResponse>(
    `/api/boards/${normalizedBoardName}/${contentId}/comments?siteName=${normalizedSiteName}`,
    '댓글 목록을 불러오지 못했습니다.',
  );
  const initialSubscriptionStatus = initial.data?.series
    ? await getSiteApiData<SubscriptionStatusResponse>(
        `/api/payments/portone/subscriptions/status?${new URLSearchParams({
          siteName: normalizedSiteName,
          boardName: normalizedBoardName,
          targetType: 'series',
          seriesName: initial.data.series.series_key,
        }).toString()}`,
        '구독 상태를 확인하지 못했습니다.',
      )
    : { data: null, error: '' };
  const initialLinkPreviews = await getLinkPreviews(initial.data?.content?.content_simple);

  return (
    <Opt
      isCommunity={isCommunity}
      initialData={initial.data}
      initialError={initial.error}
      initialPoll={initialPoll.data}
      initialPollError={initialPoll.error}
      initialComments={initialComments.data}
      initialSubscriptionStatus={initialSubscriptionStatus.data}
      initialLinkPreviews={initialLinkPreviews}
    />
  );
}
