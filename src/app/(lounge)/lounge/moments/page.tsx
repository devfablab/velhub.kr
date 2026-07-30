import { Metadata } from 'next';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { originTitle, Seo } from '@/lib/seo';
import Container from '../../menu';
import Aside from '../aside';
import styles from '@/app/page.module.sass';

export async function generateMetadata(): Promise<Metadata> {
  const timestamp = Date.now();

  return Seo({
    pageTitles: `모먼트 - ${originTitle}`,
    pageTitle: `모먼트`,
    pageDescription: `Everyday Everywhere Everymonents`,
    pageImg: `https://velhub.xyz/og-etc.webp?ts=${timestamp}`,
    pagePath: '/lounge/moments',
  });
}

export default async function Page() {
  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <div className="paper page-info">
            <AutoAwesomeRoundedIcon />
            <h2>모먼트</h2>
            <p>열심히 개발 중입니다! 😎</p>
          </div>
        </div>
        <Aside />
      </div>
    </Container>
  );
}
