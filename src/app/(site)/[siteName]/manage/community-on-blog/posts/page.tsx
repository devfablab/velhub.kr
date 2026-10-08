import Opt, { type BlogCommunityManageResponse } from '../opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

export default async function Page({ params }: { params: Promise<{ siteName: string }> }) {
  const { siteName } = await params;
  const initial = await getSiteApiData<BlogCommunityManageResponse>(
    `/api/site/${siteName}/community-on-blog?manage=1`,
    '커뮤니티 관리 정보를 불러오지 못했습니다.',
  );
  return <Opt initialData={initial.data} initialError={initial.error} />;
}
