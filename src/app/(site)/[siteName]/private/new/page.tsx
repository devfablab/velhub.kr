import { getSiteApiData } from '../../../getSiteApiData';
import Container from '../../menu';
import Opt, { type Response } from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;
  const initial = await getSiteApiData<Response>(`/api/private-board?siteName=${encodeURIComponent(siteName)}`, '글 작성 정보를 불러오지 못했습니다.');

  return (
    <Container pageBack={`/${siteName}/private`} pageTitle="글쓰기" pageFin>
      <Opt initialData={initial.data} initialError={initial.error} initialStatus={initial.status} />
    </Container>
  );
}
