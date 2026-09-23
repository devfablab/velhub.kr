import { normalizeText } from '@/lib/utils';
import Opt from './opt';
import type { StatusResponse, ContentResponse, CategoryListResponse, SeriesListResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';
type Props = { params: Promise<{ siteName: string; contentId: string }> };
export default async function Page({ params }: Props) {
  const { siteName, contentId } = await params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const statusData = await getSiteApiData<StatusResponse>(
    `/api/manage/contents/blog-posts/status?siteName=${normalizedSiteName}`,
    '블로그 상태를 확인하지 못했습니다.',
  );
  let contentData = null,
    categoryData = null,
    seriesData = null;
  if (statusData.data?.hasBoard && statusData.data?.boardName) {
    const boardName = statusData.data.boardName;
    [contentData, categoryData, seriesData] = await Promise.all([
      getSiteApiData<ContentResponse>(
        `/api/boards/${boardName}/${contentId}?siteName=${normalizedSiteName}`,
        '글을 불러오지 못했습니다.',
      ),
      getSiteApiData<CategoryListResponse>(
        `/api/boards/${boardName}/category?siteName=${normalizedSiteName}`,
        '카테고리를 불러오지 못했습니다.',
      ),
      getSiteApiData<SeriesListResponse>(
        `/api/boards/${boardName}/series?siteName=${normalizedSiteName}`,
        '시리즈를 불러오지 못했습니다.',
      ),
    ]);
  }
  return (
    <Opt
      initialStatus={statusData.data}
      initialContent={contentData?.data}
      initialCategory={categoryData?.data}
      initialSeries={seriesData?.data}
      initialError={statusData.error || contentData?.error}
    />
  );
}
