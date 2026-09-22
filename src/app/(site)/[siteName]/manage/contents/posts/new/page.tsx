import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import Opt from './opt';
import type { CategoryListResponse, SeriesListResponse, StatusResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();

  const supabaseAdmin = getSupabaseAdmin();

  const siteInfo = await supabaseAdmin
    .from('rhizomes')
    .select('site_type')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (siteInfo.data?.site_type !== 'blog') {
    redirect(`/${normalizedSiteName}/manage/contents/posts`);
  }

  const status = await getSiteApiData<StatusResponse>(
    `/api/manage/contents/blog-posts/status?siteName=${normalizedSiteName}`,
    '블로그 상태를 확인하지 못했습니다.',
  );
  let categories: CategoryListResponse | null = null;
  let series: SeriesListResponse | null = null;
  let initialError = status.error;

  if (status.data?.hasBoard && status.data.boardName) {
    const [categoryResult, seriesResult] = await Promise.all([
      getSiteApiData<CategoryListResponse>(
        `/api/boards/${status.data.boardName}/category?siteName=${normalizedSiteName}`,
        '카테고리 목록을 불러오지 못했습니다.',
      ),
      getSiteApiData<SeriesListResponse>(
        `/api/boards/${status.data.boardName}/series?siteName=${normalizedSiteName}`,
        '연재 목록을 불러오지 못했습니다.',
      ),
    ]);
    categories = categoryResult.data;
    series = seriesResult.data;
    initialError ||= categoryResult.error || seriesResult.error;
  }

  return <Opt initialStatus={status.data} initialCategories={categories} initialSeries={series} initialError={initialError} />;
}
