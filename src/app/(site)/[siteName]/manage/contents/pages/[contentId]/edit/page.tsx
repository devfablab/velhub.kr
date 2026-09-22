import { normalizeText } from '@/lib/utils';
import Opt from './opt';
import type { StatusResponse, ContentResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';
type Props = { params: Promise<{ siteName: string, contentId: string }> };
export default async function Page({ params }: Props) {
  const { siteName, contentId } = await params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const statusData = await getSiteApiData<StatusResponse>(`/api/manage/contents/pages/status?siteName=${normalizedSiteName}`, '페이지 상태를 불러오지 못했습니다.');
  let contentData = null;
  if (statusData.data?.boardName) {
    contentData = await getSiteApiData<ContentResponse>(`/api/boards/${statusData.data.boardName}/${contentId}?siteName=${normalizedSiteName}`, '글을 불러오지 못했습니다.');
  }
  return <Opt initialStatus={statusData.data} initialContent={contentData?.data ?? null} initialError={statusData.error || contentData?.error} />;
}
