import {
  getMostReadMomentPosts,
  getNewMomentCreators,
  getNewMomentSites,
  getRecentMomentPosts,
  getRisingMomentCreators,
  getRisingMomentSites,
  getTrendingMomentPosts,
  type MomentAudience,
} from '@/lib/service/lounge/loungeMoments';
import type { PostsResponse } from '../../page';
import List from '../list';
import Slick from '../slick';

type MomentsContentProps = {
  audience: Exclude<MomentAudience, 'all'>;
};

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

function MomentList({ orderType, initialData }: { orderType: 'hits' | 'newest'; initialData: PostsResponse | null }) {
  return initialData?.posts.length ? <List orderType={orderType} initialData={initialData} /> : null;
}

async function CreatorMoments() {
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
    <>
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
          <MomentList orderType="newest" initialData={recentPostsData} />
        </section>
      ) : null}
      {trendingPostsData?.posts.length ? (
        <section>
          <h2>인기 급상승 글 🔥</h2>
          <MomentList orderType="hits" initialData={trendingPostsData} />
        </section>
      ) : null}
      {popularPostsData?.posts.length ? (
        <section>
          <h2>지금 많이 읽는 글 👀</h2>
          <MomentList orderType="hits" initialData={popularPostsData} />
        </section>
      ) : null}
    </>
  );
}

async function OwnerMoments() {
  const [newSitesData, risingSitesData, recentPostsData, trendingPostsData, popularPostsData] = await Promise.all([
    getMomentData(async () => ({ sites: await getNewMomentSites(20, 'owner') })),
    getMomentData(async () => ({ sites: await getRisingMomentSites() })),
    getMomentData(async () => toPostsData(await getRecentMomentPosts(50, 'owner'))),
    getMomentData(async () => toPostsData(await getTrendingMomentPosts(50, 'owner'))),
    getMomentData(async () => toPostsData(await getMostReadMomentPosts(50, 'owner'))),
  ]);

  return (
    <>
      {newSitesData?.sites.length ? (
        <section>
          <h2>새로 문 연 사이트 👋</h2>
          <Slick sitesCreatedData={newSitesData} />
        </section>
      ) : null}
      {risingSitesData?.sites.length ? (
        <section>
          <h2>인기 급상승 사이트 🔥</h2>
          <Slick sitesHitsData={risingSitesData} />
        </section>
      ) : null}
      {recentPostsData?.posts.length ? (
        <section>
          <h2>새로 올라온 글 🧐</h2>
          <MomentList orderType="newest" initialData={recentPostsData} />
        </section>
      ) : null}
      {trendingPostsData?.posts.length ? (
        <section>
          <h2>인기 급상승 글 🔥</h2>
          <MomentList orderType="hits" initialData={trendingPostsData} />
        </section>
      ) : null}
      {popularPostsData?.posts.length ? (
        <section>
          <h2>지금 많이 읽는 글 👀</h2>
          <MomentList orderType="hits" initialData={popularPostsData} />
        </section>
      ) : null}
    </>
  );
}

async function NewbieMoments() {
  const [newSitesData, recentPostsData] = await Promise.all([
    getMomentData(async () => ({ sites: await getNewMomentSites(10, 'newbie') })),
    getMomentData(async () => toPostsData(await getRecentMomentPosts(20, 'newbie'))),
  ]);

  return (
    <>
      {newSitesData?.sites.length ? (
        <section>
          <h2>새로 오픈했어요 👋</h2>
          <Slick sitesCreatedData={newSitesData} />
        </section>
      ) : null}
      {recentPostsData?.posts.length ? (
        <section>
          <h2>새로운 글 알리미! 🥰</h2>
          <Slick postsData={recentPostsData} />
        </section>
      ) : null}
      {recentPostsData?.posts.length ? (
        <section>
          <h2>여러분의 관심이 필요해요 🥹</h2>
          <MomentList orderType="newest" initialData={recentPostsData} />
        </section>
      ) : null}
    </>
  );
}

export default async function MomentsContent({ audience }: MomentsContentProps) {
  if (audience === 'creator') return <CreatorMoments />;
  if (audience === 'owner') return <OwnerMoments />;
  return <NewbieMoments />;
}
