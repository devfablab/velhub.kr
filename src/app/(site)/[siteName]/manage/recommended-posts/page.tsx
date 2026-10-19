import Opt, { type RecommendedPostsResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type RouteContext = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const initial = await getSiteApiData<RecommendedPostsResponse>(
    `/api/manage/recommended-posts?siteName=${encodeURIComponent(siteName)}`,
    '추천 포스팅을 불러오지 못했습니다.',
  );

  return <Opt initialData={initial.data} initialError={initial.error} />;
}
