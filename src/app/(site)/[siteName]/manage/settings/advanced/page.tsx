import Opt from './opt';
import type { AdvancedInfoResponse, AdvancedSitesResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type RouteContext = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const [info, sites] = await Promise.all([
    getSiteApiData<AdvancedInfoResponse>(`/api/info/general/site/${siteName}`, '사이트 정보를 불러오지 못했습니다.'),
    getSiteApiData<AdvancedSitesResponse>(`/api/info/advanced/site/${siteName}`, '사이트 설정을 불러오지 못했습니다.'),
  ]);

  return <Opt initialInfo={info.data} initialSites={sites.data} initialError={info.error || sites.error} />;
}
