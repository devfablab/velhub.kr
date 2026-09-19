import Opt from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';
import type { HotPostResponse } from './opt';

type RouteContext = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const initial = await getSiteApiData<HotPostResponse>(`/api/manage/stats/hot-post?siteName=${siteName}&range=today`, '인기글 순위를 불러오지 못했습니다.');

  return <Opt initialData={initial.data} initialError={initial.error} />;
}
