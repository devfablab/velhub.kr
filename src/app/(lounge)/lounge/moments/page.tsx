import { Metadata } from 'next';
import {
  getMostReadMomentPosts,
  getNewMomentCreators,
  getNewMomentSites,
  getRecentMomentPosts,
  getRisingMomentCreators,
  getTrendingMomentPosts,
} from '@/lib/lounge/moments';
import { originTitle, Seo } from '@/lib/seo';
import Container from '../../menu';
import type { PostsResponse } from '../../page';
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
  async function getMomentData<T>(load: () => Promise<T>): Promise<T | null> {
    try {
      return await load();
    } catch {
      return null;
    }
  }

  function toPostsData(posts: Awaited<ReturnType<typeof getRecentMomentPosts>>): PostsResponse {
    return { posts: posts as unknown as PostsResponse['posts'] };
  }

  const [newSitesData, newCreatorsData, risingCreatorsData, recentPostsData, trendingPostsData, popularPostsData] =
    await Promise.all([
      getMomentData(async () => ({ sites: await getNewMomentSites() })),
      getMomentData(async () => ({ creators: await getNewMomentCreators() })),
      getMomentData(async () => ({ creators: await getRisingMomentCreators() })),
      getMomentData(async () => toPostsData(await getRecentMomentPosts())),
      getMomentData(async () => toPostsData(await getTrendingMomentPosts())),
      getMomentData(async () => toPostsData(await getMostReadMomentPosts())),
    ]);

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          {newSitesData?.sites.length ? (
            <section>
              <h2>새로 문 연 공간 👋</h2>
              <Slick sitesCreatedData={newSitesData} />
            </section>
          ) : null}
          {newCreatorsData?.creators.length ? (
            <section>
              <h2>인사해 주세요 👋</h2>
              <Slick creatorLibrariesData={newCreatorsData} />
            </section>
          ) : null}
          {risingCreatorsData?.creators.length ? (
            <section>
              <h2>인기 급상승 서재 🔥</h2>
              <Slick creatorLibrariesData={risingCreatorsData} />
            </section>
          ) : null}
          {recentPostsData?.posts.length ? (
            <section>
              <h2>작가들에게 무슨 일이 있나요? 🧐</h2>
              <List orderType="newest" initialData={recentPostsData} />
            </section>
          ) : null}
          {trendingPostsData?.posts.length ? (
            <section>
              <h2>인기 급상승 글 🔥</h2>
              <List orderType="hits" initialData={trendingPostsData} />
            </section>
          ) : null}
          {popularPostsData?.posts.length ? (
            <section>
              <h2>지금 많이 읽는 글 👀</h2>
              <List orderType="hits" initialData={popularPostsData} />
            </section>
          ) : null}
        </div>
        <Aside />
      </div>
    </Container>
  );
}
