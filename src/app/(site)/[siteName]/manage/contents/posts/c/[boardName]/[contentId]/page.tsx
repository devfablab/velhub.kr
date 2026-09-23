import { normalizeText } from '@/lib/utils';
import Opt from './opt';
import type { ContentResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';
type Props = { params: Promise<{ siteName: string; boardName: string; contentId: string }> };
export default async function Page({ params }: Props) {
  const { siteName, boardName, contentId } = await params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const normalizedBoardName = normalizeText(boardName).toLowerCase();
  const contentData = await getSiteApiData<ContentResponse>(
    `/api/boards/${normalizedBoardName}/${contentId}?siteName=${normalizedSiteName}`,
    '글을 불러오지 못했습니다.',
  );
  return <Opt initialContent={contentData?.data} initialError={contentData?.error} />;
}
