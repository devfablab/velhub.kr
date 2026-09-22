import { normalizeText } from '@/lib/utils';
import Opt from './opt';
import type { ContentResponse, SeriesListResponse, PrefixListResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';
type Props = { params: Promise<{ siteName: string, boardName: string, contentId: string }> };
export default async function Page({ params }: Props) {
  const { siteName, boardName, contentId } = await params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const normalizedBoardName = normalizeText(boardName).toLowerCase();
  const [contentData, seriesData, prefixData] = await Promise.all([
    getSiteApiData<ContentResponse>(`/api/boards/${normalizedBoardName}/${contentId}?siteName=${normalizedSiteName}`, '글을 불러오지 못했습니다.'),
    getSiteApiData<SeriesListResponse>(`/api/boards/${normalizedBoardName}/series?siteName=${normalizedSiteName}`, '시리즈를 불러오지 못했습니다.'),
    getSiteApiData<PrefixListResponse>(`/api/boards/${normalizedBoardName}/prefix?siteName=${normalizedSiteName}`, '말머리를 불러오지 못했습니다.')
  ]);
  return <Opt initialContent={contentData?.data} initialSeries={seriesData?.data} initialPrefix={prefixData?.data} initialError={contentData?.error || seriesData?.error || prefixData?.error} />;
}
