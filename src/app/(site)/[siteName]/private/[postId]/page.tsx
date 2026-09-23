import { getSiteApiData } from '../../../getSiteApiData';
import Container from '../../menu';
import Opt, { type Data } from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
    postId: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName, postId } = await context.params;
  const initial = await getSiteApiData<Data>(
    `/api/private-board/${postId}?siteName=${siteName}`,
    '글 정보를 불러오지 못했습니다.',
  );

  return (
    <Container pageBack={`/${siteName}/private`} pageTitle="글 보기" pageFin>
      <Opt initialData={initial.data} initialError={initial.error} />
    </Container>
  );
}
