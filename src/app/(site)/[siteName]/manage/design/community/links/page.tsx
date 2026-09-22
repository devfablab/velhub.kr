import Opt from './opt';
import type { LinkResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type RouteContext = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const initial = await getSiteApiData<LinkResponse>(`/api/manage/design/community/links?siteName=${siteName}`, '커뮤니티 링크를 불러오지 못했습니다.');
  return <Opt initialData={initial.data} initialError={initial.error} />;
}
