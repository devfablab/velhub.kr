import { notFound } from 'next/navigation';
import { getPostPageMetadata } from '@/lib/seoSite';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import type { CommentsResponse } from '@/components/comments/CommentList';
import { getSiteApiData } from '../../../getSiteApiData';
import Opt, { type ContentResponse } from './opt';

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

  return (
    <Opt
      isCommunity={isCommunity}
      initialData={initial.data}
      initialError={initial.error}
      initialComments={initialComments.data}
    />
  );
}
