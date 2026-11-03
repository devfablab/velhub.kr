import { Metadata } from 'next';
import { originTitle, Seo } from '@/lib/seo';
import Container from '../../menu';
import Aside from '../aside';
import MomentsContent from './MomentsContent';
import MomentSubMenu from './MomentSubMenu';
import styles from '@/app/page.module.sass';

export async function generateMetadata(): Promise<Metadata> {
  const timestamp = Date.now();

  return Seo({
    pageTitles: `모먼트 - ${originTitle}`,
    pageTitle: '뉴비 창작자',
    pageDescription: '새롭게 라운지에 소개되는 창작자와 사이트를 만나보세요.',
    pageImg: `https://velhub.xyz/og-etc.webp?ts=${timestamp}`,
    pagePath: '/lounge/moments',
  });
}

export default async function Page() {
  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <MomentSubMenu />
          <MomentsContent audience="newbie" />
        </div>
        <Aside />
      </div>
    </Container>
  );
}
