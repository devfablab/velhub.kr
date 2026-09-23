import { normalizeText } from '@/lib/utils';
import Opt from './opt';
import type { BoardInfoResponse, SeriesListResponse, PrefixListResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';
type Props = { params: Promise<{ siteName: string; boardName: string }> };
export default async function Page({ params }: Props) {
  const { siteName, boardName } = await params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const normalizedBoardName = normalizeText(boardName).toLowerCase();
  const [boardData, seriesData, prefixData] = await Promise.all([
    getSiteApiData<BoardInfoResponse>(
      `/api/boards/${normalizedBoardName}?siteName=${normalizedSiteName}`,
      '게시판 정보를 불러오지 못했습니다.',
    ),
    getSiteApiData<SeriesListResponse>(
      `/api/boards/${normalizedBoardName}/series?siteName=${normalizedSiteName}`,
      '시리즈를 불러오지 못했습니다.',
    ),
    getSiteApiData<PrefixListResponse>(
      `/api/boards/${normalizedBoardName}/prefix?siteName=${normalizedSiteName}`,
      '말머리를 불러오지 못했습니다.',
    ),
  ]);
  return (
    <Opt
      initialBoard={boardData?.data}
      initialSeries={seriesData?.data}
      initialPrefix={prefixData?.data}
      initialError={boardData?.error || seriesData?.error || prefixData?.error}
    />
  );
}
