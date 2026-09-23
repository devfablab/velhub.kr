import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import Opt from './opt';
import type { StatusResponse, SeriesListResponse } from './opt';
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

  const statusData = await getSiteApiData<StatusResponse>(
    `/api/manage/contents/blog-posts/status?siteName=${normalizedSiteName}`,
    '블로그 상태를 확인하지 못했습니다.',
  );

  let seriesData = null;
  if (statusData.data?.hasBoard && statusData.data?.boardName) {
    seriesData = await getSiteApiData<SeriesListResponse>(
      `/api/boards/${statusData.data.boardName}/series?siteName=${normalizedSiteName}`,
      '연재 목록을 불러오지 못했습니다.',
    );
  }

  return (
    <Opt
      initialStatus={statusData.data}
      initialSeries={seriesData?.data}
      initialError={statusData.error || seriesData?.error}
    />
  );
}
