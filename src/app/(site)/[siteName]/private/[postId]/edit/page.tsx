import { getSiteApiData } from '../../../../getSiteApiData';
import Container from '../../../menu';
import Opt, { type BoardResponse, type PostResponse } from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
    postId: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName, postId } = await context.params;
  const [initialBoard, initialPost] = await Promise.all([
    getSiteApiData<BoardResponse>(`/api/private-board?siteName=${encodeURIComponent(siteName)}`, '글 수정 정보를 불러오지 못했습니다.'),
    getSiteApiData<PostResponse>(`/api/private-board/${encodeURIComponent(postId)}?siteName=${encodeURIComponent(siteName)}`, '글 수정 정보를 불러오지 못했습니다.'),
  ]);
  const initialError = initialBoard.error || initialPost.error || (!initialPost.data?.post ? '글 수정 정보를 불러오지 못했습니다.' : '');

  return (
    <Container pageBack={`/${siteName}/private`} pageTitle="글 수정" pageFin>
      <Opt
        initialBoard={initialBoard.data}
        initialPost={initialPost.data}
        initialError={initialError}
        initialStatus={initialBoard.status === 401 || initialPost.status === 401 ? 401 : Math.max(initialBoard.status, initialPost.status)}
      />
    </Container>
  );
}
