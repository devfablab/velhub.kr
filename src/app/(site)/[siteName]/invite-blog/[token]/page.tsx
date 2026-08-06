import SiteProfile from '@/components/service/blog/SiteProfile';
import Container from '../../menu';
import Opt from './opt';
import styles from '@/app/board.module.sass';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;

  return (
    <Container pageBack={`/${siteName}`} pageTitle="블로그 가입">
      <div className="container">
        <div className={`content ${styles.content} ${styles['blog-content']} `}>
          <SiteProfile />
          <Opt />
        </div>
      </div>
    </Container>
  );
}
