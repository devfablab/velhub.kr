import { getSiteApiData } from '../../getSiteApiData';
import Container from '../menu';
import Opt, { type Response } from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

type SearchContext = RouteContext & {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page(context: SearchContext) {
  const { siteName } = await context.params;
  const searchParams = await context.searchParams;
  const filter = typeof searchParams.filter === 'string' ? searchParams.filter : 'all';
  const page = typeof searchParams.page === 'string' ? searchParams.page : '1';
  const initial = await getSiteApiData<Response>(
    `/api/private-board?siteName=${siteName}&filter=${encodeURIComponent(filter)}&page=${encodeURIComponent(page)}`,
    '비공개 게시글을 불러오지 못했습니다.',
  );

  return (
    <Container pageBack={`/${siteName}`} pageTitle={initial.data?.board?.board_label ?? '비공개 게시판'}>
      <Opt initialData={initial.data} initialError={initial.error} />
    </Container>
  );
}
