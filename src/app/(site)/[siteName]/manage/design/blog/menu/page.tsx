import { getSiteApiData } from '@/lib/service/site/getSiteApiData';
import Opt from './opt';
import type { InitialMenuResponse } from './opt';

type RouteContext = { params: Promise<{ siteName: string }> };
export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const initial = await getSiteApiData<InitialMenuResponse>(
    `/api/manage/design/shared/menu?siteName=${siteName}`,
    '메뉴 설정을 불러오지 못했습니다.',
  );
  return <Opt initialData={initial.data} initialError={initial.error} />;
}
