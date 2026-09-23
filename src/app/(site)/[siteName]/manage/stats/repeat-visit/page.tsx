import Opt from './opt';
import type { RepeatVisitResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type RouteContext = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const initial = await getSiteApiData<RepeatVisitResponse>(
    `/api/manage/stats/repeat-visit?siteName=${siteName}&range=week`,
    '재방문율 통계를 불러오지 못했습니다.',
  );

  return <Opt initialData={initial.data} initialError={initial.error} />;
}
