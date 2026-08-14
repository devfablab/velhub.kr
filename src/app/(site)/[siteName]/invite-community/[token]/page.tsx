import SiteInfo from '@/components/service/community/SiteInfo';
import Container from '../../menu';
import Aside from './aside';
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
    <Container pageBack={`/${siteName}`} pageTitle="커뮤니티 가입">
      <div className="container">
        <aside>
          <SiteInfo />
        </aside>
        <div className={`content ${styles.content} ${styles['home-content']} `}>
          <Opt />
        </div>
        <Aside />
      </div>
    </Container>
  );
}
