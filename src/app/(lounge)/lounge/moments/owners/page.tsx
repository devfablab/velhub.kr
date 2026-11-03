import { Metadata } from 'next';
import { originTitle, Seo } from '@/lib/seo';
import Container from '../../../menu';
import Aside from '../../aside';
import MomentsContent from '../MomentsContent';
import MomentSubMenu from '../MomentSubMenu';
import styles from '@/app/page.module.sass';

export async function generateMetadata(): Promise<Metadata> {
  return Seo({
    pageTitles: `오너 모먼트 - ${originTitle}`,
    pageTitle: '오너 모먼트',
    pageDescription: '라운지에 소개되는 오너의 사이트와 글을 만나보세요.',
    pageImg: 'https://velhub.xyz/og-etc.webp',
    pagePath: '/lounge/moments/owners',
  });
}

export default async function Page() {
  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <MomentSubMenu />
          <MomentsContent audience="owner" />
        </div>
        <Aside />
      </div>
    </Container>
  );
}
