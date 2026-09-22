import Opt from './opt';
import type { InactiveStatsResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type RouteContext = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const initial = await getSiteApiData<InactiveStatsResponse>(`/api/manage/stats/inactive?siteName=${siteName}&range=week`, '비활동 유저 통계를 불러오지 못했습니다.');

  return <Opt initialData={initial.data} initialError={initial.error} />;
}
