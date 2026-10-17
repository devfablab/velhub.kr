import Opt, { type GuidelinesResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type RouteContext = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const initial = await getSiteApiData<GuidelinesResponse>(
    `/api/manage/guidelines?siteName=${encodeURIComponent(siteName)}`,
    '가이드라인을 불러오지 못했습니다.',
  );

  return <Opt initialData={initial.data} initialError={initial.error} />;
}
