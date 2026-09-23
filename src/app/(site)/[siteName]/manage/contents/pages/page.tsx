import Opt from './opt';
import type { InitialPagesData } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type RouteContext = { params: Promise<{ siteName: string }> };

type PagesStatusResponse = { hasBoard?: boolean; boardName?: string; error?: string };
type BoardPagesResponse = { pages?: InitialPagesData['pages']; error?: string };

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const status = await getSiteApiData<PagesStatusResponse>(
    `/api/manage/contents/pages/status?siteName=${siteName}`,
    '페이지 상태를 확인하지 못했습니다.',
  );
  if (status.error || !status.data?.hasBoard || !status.data.boardName) {
    return <Opt initialData={null} initialError={status.error} />;
  }
  const board = await getSiteApiData<BoardPagesResponse>(
    `/api/boards/${status.data.boardName}?siteName=${siteName}&page=1`,
    '페이지 목록을 불러오지 못했습니다.',
  );
  return (
    <Opt
      initialData={{ boardName: status.data.boardName, pages: board.data?.pages ?? [] }}
      initialError={board.error}
    />
  );
}
