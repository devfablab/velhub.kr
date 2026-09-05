import { Metadata } from 'next';
import { headers } from 'next/headers';
import { originTitle, Seo } from '@/lib/seo';
import ScreenState from '@/components/service/ScreenState';
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
  let supportCreatorsError = '';
  let supportCreatorsListError = '';
  let recentCreatorsError = '';

  try {
    const supportCreatorsResponse = await fetch(`${baseUrl}/api/home/moments/support?limit=10`, {
      cache: 'no-store',
    });
    if (supportCreatorsResponse.ok) {
      supportCreatorsData = await supportCreatorsResponse.json();
    } else {
      supportCreatorsError = '서포트 작가를 불러오지 못했습니다.';
    }

    const supportCreatorsListResponse = await fetch(`${baseUrl}/api/home/moments/support?limit=100`, {
      cache: 'no-store',
    });
    if (supportCreatorsListResponse.ok) {
      supportCreatorsListData = await supportCreatorsListResponse.json();
    } else {
      supportCreatorsListError = '서포트 크리에이터를 불러오지 못했습니다.';
    }

    const recentCreatorsResponse = await fetch(`${baseUrl}/api/home/moments/recent-creators?limit=100`, {
      cache: 'no-store',
    });
    if (recentCreatorsResponse.ok) {
      recentCreatorsData = await recentCreatorsResponse.json();
    } else {
      recentCreatorsError = '최근 승인된 작가를 불러오지 못했습니다.';
    }
  } catch (error) {
    console.error('Fetch Failed:', error);
    supportCreatorsError ||= '서포트 작가를 불러오지 못했습니다.';
    supportCreatorsListError ||= '서포트 크리에이터를 불러오지 못했습니다.';
    recentCreatorsError ||= '최근 승인된 작가를 불러오지 못했습니다.';
  }

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <section>
            <h2>서포트 작가전 🚀</h2>
            {supportCreatorsError ? (
              <ScreenState kind="error">{supportCreatorsError}</ScreenState>
            ) : supportCreatorsData && (supportCreatorsData.sites || supportCreatorsData.posts) ? (
              <Slick
                sitesHitsData={supportCreatorsData.sites ? supportCreatorsData : undefined}
                postsData={supportCreatorsData.posts ? supportCreatorsData : undefined}
              />
            ) : (
              <ScreenState>아직 등록된 서포트 작가가 없습니다.</ScreenState>
            )}
          </section>
          <section>
            <h2>서포트 크리에이터 ✨</h2>
            {supportCreatorsListError ? (
              <ScreenState kind="error">{supportCreatorsListError}</ScreenState>
            ) : supportCreatorsListData && (supportCreatorsListData.sites || supportCreatorsListData.posts) ? (
              <List
                postsData={supportCreatorsListData.posts ? supportCreatorsListData : undefined}
                orderType="newest"
              />
            ) : (
              <ScreenState>아직 등록된 서포트 크리에이터가 없습니다.</ScreenState>
            )}
          </section>
          <section>
            <h2>작가들에게 무슨 일이 있나요? 🧐</h2>
            {recentCreatorsError ? (
              <ScreenState kind="error">{recentCreatorsError}</ScreenState>
            ) : recentCreatorsData && recentCreatorsData.posts ? (
              <List postsData={recentCreatorsData} orderType="newest" />
            ) : (
              <ScreenState>최근 승인된 작가가 없습니다.</ScreenState>
            )}
          </section>
        </div>
        <Aside />
      </div>
    </Container>
  );
}
