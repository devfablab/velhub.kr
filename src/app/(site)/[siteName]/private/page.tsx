import Container from '../menu';
import Opt from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;

  return (
    <Container pageBack={`/${siteName}`} pageTitle="비공개 게시판">
      <Opt />
    </Container>
  );
}
