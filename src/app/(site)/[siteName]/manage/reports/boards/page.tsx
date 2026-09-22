import Container from '../../menu';
import ReportManage from '../reportManage';
import type { ReportListResponse } from '../reportManage';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type RouteContext = { params: Promise<{ siteName: string }> };
export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const initial = await getSiteApiData<ReportListResponse>(`/api/manage/reports?siteName=${siteName}&targetType=board&mode=current`, '신고 목록을 불러오지 못했습니다.');
  return (
    <Container pageTitle="게시판 신고" menu="reports">
      <ReportManage targetType="board" initialData={initial.data} initialError={initial.error} />
    </Container>
  );
}
