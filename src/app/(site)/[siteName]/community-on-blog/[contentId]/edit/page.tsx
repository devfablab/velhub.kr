import { getSiteGuidelineDialogData } from '@/lib/siteGuidelines/server';
import Opt, { type BlogCommunityEditResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

export default async function Page({ params }: { params: Promise<{ siteName: string; contentId: string }> }) {
  const { siteName, contentId } = await params;
  const [initial, guidelineDialogData] = await Promise.all([
    getSiteApiData<BlogCommunityEditResponse>(
      `/api/site/${siteName}/community-on-blog/${contentId}`,
      '커뮤니티 글을 불러오지 못했습니다.',
    ),
    getSiteGuidelineDialogData({ siteName, target: 'blog-community' }),
  ]);

  return <Opt initialData={initial.data} initialError={initial.error} guidelineDialogData={guidelineDialogData} />;
}
