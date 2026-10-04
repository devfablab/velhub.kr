import { type BlogCommunityResponse } from '../opt';
import Opt from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';
export default async function Page({ params }: { params: Promise<{ siteName: string }> }) {
  const { siteName } = await params;
  const initial = await getSiteApiData<BlogCommunityResponse>(
    `/api/site/${siteName}/community-on-blog?summary=1`,
    '블로그 커뮤니티를 불러오지 못했습니다.',
  );
  return <Opt initialData={initial.data} initialError={initial.error} />;
}
