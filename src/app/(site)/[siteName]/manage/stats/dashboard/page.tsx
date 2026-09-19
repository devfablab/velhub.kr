import Opt from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';
import type { DashboardResponse } from './opt';

type RouteContext = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const initial = await getSiteApiData<DashboardResponse>(`/api/manage/stats/dashboard?siteName=${siteName}`, '통계 정보를 불러오지 못했습니다.');

  return <Opt initialData={initial.data} initialError={initial.error} />;
}
