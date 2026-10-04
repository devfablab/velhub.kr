import Opt, { type BlogCommunityResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ siteName: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { siteName } = await params;
  const { page } = await searchParams;
  const requestedPage = Number(page ?? '1');
  const safePage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const initial = await getSiteApiData<BlogCommunityResponse>(
    `/api/site/${siteName}/community-on-blog?page=${safePage}`,
    '블로그 커뮤니티를 불러오지 못했습니다.',
  );

  return <Opt initialData={initial.data} initialError={initial.error} />;
}
