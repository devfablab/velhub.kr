import { Metadata } from 'next';
import { headers } from 'next/headers';
import { originTitle, Seo } from '@/lib/seo';
import Container from '../../menu';
import Aside from '../aside';
import List from '../list';
import Slick from '../slick';
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
  const headerList = await headers();
  const host = headerList.get('host');
  const protocol = headerList.get('x-forwarded-proto') || 'http';
  const baseUrl = `${protocol}://${host}`;
  
  let supportCreatorsData = null;
  let supportCreatorsListData = null;
  let recentCreatorsData = null;

  try {
    const supportCreatorsResponse = await fetch(`${baseUrl}/api/home/moments/support?limit=10`, {
      cache: 'no-store',
    });
    if (supportCreatorsResponse.ok) supportCreatorsData = await supportCreatorsResponse.json();

    const supportCreatorsListResponse = await fetch(`${baseUrl}/api/home/moments/support?limit=100`, {
      cache: 'no-store',
    });
    if (supportCreatorsListResponse.ok) supportCreatorsListData = await supportCreatorsListResponse.json();

    const recentCreatorsResponse = await fetch(`${baseUrl}/api/home/moments/recent-creators?limit=100`, {
      cache: 'no-store',
    });
    if (recentCreatorsResponse.ok) recentCreatorsData = await recentCreatorsResponse.json();
  } catch (error) {
    console.error('Fetch Failed:', error);
  }

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <section>
            <h2>서포트 작가전 🚀</h2>
            {supportCreatorsData && (supportCreatorsData.sites || supportCreatorsData.posts) ? (
              <Slick sitesHitsData={supportCreatorsData.sites ? supportCreatorsData : undefined} postsData={supportCreatorsData.posts ? supportCreatorsData : undefined} />
            ) : (
              <div className="paper"><p>아직 등록된 서포트 작가가 없습니다.</p></div>
            )}
          </section>
          <section>
            <h2>서포트 크리에이터 ✨</h2>
            {supportCreatorsListData && (supportCreatorsListData.sites || supportCreatorsListData.posts) ? (
              <List postsData={supportCreatorsListData.posts ? supportCreatorsListData : undefined} orderType="newest" />
            ) : (
              <div className="paper"><p>아직 등록된 서포트 크리에이터가 없습니다.</p></div>
            )}
          </section>
          <section>
            <h2>작가들에게 무슨 일이 있나요? 🧐</h2>
            {recentCreatorsData && recentCreatorsData.posts ? (
              <List postsData={recentCreatorsData} orderType="newest" />
            ) : (
              <div className="paper"><p>최근 승인된 작가가 없습니다.</p></div>
            )}
          </section>
        </div>
        <Aside />
      </div>
    </Container>
  );
}
