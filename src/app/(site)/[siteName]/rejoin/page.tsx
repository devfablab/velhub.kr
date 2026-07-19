import Opt from './opt';
import Container from '../menu';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;

  return (
    <Container pageBack={`/${siteName}`} pageTitle="가입하기">
      <div className="container">
        <div className="content" style={{ maxWidth: 572 }}>
          <h2>커뮤니티 재가입</h2>
          <div className="paper" style={{ marginTop: 12 }}>
            <Opt siteName={siteName.trim().toLowerCase()} />
          </div>
        </div>
      </div>
    </Container>
  );
}
