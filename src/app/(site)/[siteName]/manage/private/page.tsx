import Opt from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';
import type { BoardResponse } from './opt';

type RouteContext = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const initial = await getSiteApiData<BoardResponse>(`/api/private-board/manage?siteName=${siteName}`, '비공개 게시판 정보를 불러오지 못했습니다.');

  return <Opt initialData={initial.data} initialError={initial.error} />;
}
