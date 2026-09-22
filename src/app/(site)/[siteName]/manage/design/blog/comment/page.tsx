import Opt from './opt';
import type { BlogCommentResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type RouteContext = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const initial = await getSiteApiData<BlogCommentResponse>(`/api/manage/design/blog/comments?siteName=${siteName}`, '댓글 설정을 불러오지 못했습니다.');
  return <Opt initialData={initial.data} initialError={initial.error} />;
}
