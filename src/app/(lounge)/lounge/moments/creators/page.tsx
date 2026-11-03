import { Metadata } from 'next';
import { originTitle, Seo } from '@/lib/seo';
import Container from '../../../menu';
import Aside from '../../aside';
import MomentsContent from '../MomentsContent';
import MomentSubMenu from '../MomentSubMenu';
import styles from '@/app/page.module.sass';

export async function generateMetadata(): Promise<Metadata> {
  return Seo({
    pageTitles: `크리에이터 모먼트 - ${originTitle}`,
    pageTitle: '크리에이터 모먼트',
    pageDescription: '라운지에 소개되는 크리에이터의 서재와 글을 만나보세요.',
    pageImg: 'https://velhub.xyz/og-etc.webp',
    pagePath: '/lounge/moments/creators',
  });
}

export default async function Page() {
  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <MomentSubMenu />
          <MomentsContent audience="creator" />
        </div>
        <Aside />
      </div>
    </Container>
  );
}
