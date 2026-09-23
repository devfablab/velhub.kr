import { normalizeText } from '@/lib/utils';
import Opt from './opt';
import type { ManagersResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type RouteContext = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const initialData = await getSiteApiData<ManagersResponse>(
    `/api/manage/join/managers?siteName=${normalizedSiteName}`,
    '매니저 정보를 불러오지 못했습니다.',
  );

  return <Opt initialData={initialData.data} initialError={initialData.error} />;
}
