import Opt, { type BlogCommunityPostResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';
import type { CommentsResponse } from '@/components/comments/CommentList';

export default async function Page({ params }: { params: Promise<{ siteName: string; contentId: string }> }) {
  const { siteName, contentId } = await params;
  const [initial, initialComments] = await Promise.all([
    getSiteApiData<BlogCommunityPostResponse>(
      `/api/site/${siteName}/community-on-blog/${contentId}`,
      '커뮤니티 글을 불러오지 못했습니다.',
    ),
    getSiteApiData<CommentsResponse>(
      `/api/site/${siteName}/community-on-blog/${contentId}/comments`,
      '댓글을 불러오지 못했습니다.',
    ),
  ]);

  return <Opt initialData={initial.data} initialError={initial.error} initialCommentsData={initialComments.data} />;
}
