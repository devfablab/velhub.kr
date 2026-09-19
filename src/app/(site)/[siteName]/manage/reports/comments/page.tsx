import Container from '../../menu';
import ReportManage from '../reportManage';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';
import type { ReportListResponse } from '../reportManage';

type RouteContext = { params: Promise<{ siteName: string }> };
export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const initial = await getSiteApiData<ReportListResponse>(`/api/manage/reports?siteName=${siteName}&targetType=comment&mode=current`, '신고 목록을 불러오지 못했습니다.');
  return (
    <Container pageTitle="댓글 신고" menu="reports">
      <ReportManage targetType="comment" initialData={initial.data} initialError={initial.error} />
    </Container>
  );
}
