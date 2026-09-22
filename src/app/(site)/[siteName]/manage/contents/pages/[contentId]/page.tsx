import Opt from './opt';
import type { InitialPageDetail } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type RouteContext = { params: Promise<{ siteName: string; contentId: string }> };
type StatusResponse = { hasBoard?: boolean; boardName?: string; error?: string };

export default async function Page({ params }: RouteContext) {
  const { siteName, contentId } = await params;
  const status = await getSiteApiData<StatusResponse>(`/api/manage/contents/pages/status?siteName=${siteName}`, '페이지 상태를 확인하지 못했습니다.');
  if (status.error || !status.data?.boardName) return <Opt initialData={null} initialError={status.error || '페이지 게시판을 찾을 수 없습니다.'} />;
  const content = await getSiteApiData<InitialPageDetail>(`/api/boards/${status.data.boardName}/${contentId}?siteName=${siteName}`, '페이지 정보를 불러오지 못했습니다.');
  return <Opt initialData={{ ...content.data, boardName: status.data.boardName }} initialError={content.error} />;
}
