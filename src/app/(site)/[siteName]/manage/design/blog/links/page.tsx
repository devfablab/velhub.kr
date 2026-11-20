import { getSiteApiData } from '@/lib/service/site/getSiteApiData';
import Opt from './opt';
import type { LinkResponse } from './opt';

type RouteContext = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const initial = await getSiteApiData<LinkResponse>(
    `/api/manage/design/blog/links?siteName=${siteName}`,
    '소셜 링크를 불러오지 못했습니다.',
  );
  return <Opt initialData={initial.data} initialError={initial.error} />;
}
