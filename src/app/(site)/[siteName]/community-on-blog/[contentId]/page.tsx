import Opt, { type BlogCommunityPostResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

export default async function Page({ params }: { params: Promise<{ siteName: string; contentId: string }> }) {
  const { siteName, contentId } = await params;
  const initial = await getSiteApiData<BlogCommunityPostResponse>(
    `/api/site/${siteName}/community-on-blog/${contentId}`,
    '커뮤니티 글을 불러오지 못했습니다.',
  );
  return <Opt initialData={initial.data} initialError={initial.error} />;
}
