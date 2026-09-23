import Opt from './opt';
import type { JoinStatsResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type RouteContext = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const initial = await getSiteApiData<JoinStatsResponse>(
    `/api/manage/stats/join?siteName=${siteName}&range=week`,
    '가입자수 통계를 불러오지 못했습니다.',
  );

  return <Opt initialData={initial.data} initialError={initial.error} />;
}
