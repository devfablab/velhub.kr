import { Metadata } from 'next';
import { getHubApiData } from '@/lib/service/hub/getData';
import type { FavoriteBlogsResponse } from '@/lib/service/hubFavoriteFolder.shared';
import { fetchApiRoute } from '@/lib/service/site/siteApiRoutes';
import ScreenState from '@/components/service/ScreenState';
import { ServiceNoDataIcon } from '@/components/Svgs';
import Container from '../menu';
import JoinSites, { JoinSiteRow } from '../shared/joinSites';
import Liked, { LikedResponse } from '../shared/liked';
import MemberStatusSites, { MemberStatusSiteRow } from '../shared/memberStatusSites';
import OwnedDonationPosts, { PostsResponse as OwnedDonationPostsResponse } from '../shared/ownedDonationPosts';
import PostHistory, { PostsResponse } from '../shared/postHistory';
import FavoriteBlogList from './favoriteBlogList';
import Content from './tab';
import styles from '@/app/hub.module.sass';

type UserResponse = {
  isLoggedIn: boolean;
  role: string | null;
  joinSites: JoinSiteRow[];
  statusSites: MemberStatusSiteRow[];
  error?: string;
};

export const metadata: Metadata = {
  title: '블로그 허브 - 마이허브 - 데브허브',
  description: '블로그 허브',
};

async function getUserJoinSites() {
  const response = await fetchApiRoute('/api/hub/user-join-sites');

  const result = (await response.json()) as UserResponse;

  if (!response.ok) {
    throw new Error(result.error || '사용자 정보를 불러오지 못했습니다.');
  }

  if (!('isLoggedIn' in result) || !Array.isArray(result.joinSites)) {
    throw new Error('사용자 정보를 불러오지 못했습니다.');
  }

  return result;
}

export default async function SectionJoinSites() {
  const listsPromise = Promise.all([
    getHubApiData<FavoriteBlogsResponse>('/api/hub/blog-favorites', '즐겨찾는 블로그를 불러오지 못했습니다.'),
    getHubApiData<LikedResponse>('/api/hub/liked?siteType=blog', '좋아요 목록을 불러오지 못했습니다.'),
    getHubApiData<PostsResponse>('/api/hub/saved-posts?siteType=blog', '저장한 글을 불러오지 못했습니다.'),
    getHubApiData<PostsResponse>('/api/hub/read-posts?siteType=blog', '읽은 글을 불러오지 못했습니다.'),
    getHubApiData<OwnedDonationPostsResponse>(
      '/api/hub/owned-donation-posts?siteType=blog',
      '소장/후원글 목록을 불러오지 못했습니다.',
    ),
  ]);
  let result: UserResponse;

  try {
    result = await getUserJoinSites();
  } catch (unknownError) {
    const errorMessage =
      unknownError instanceof Error
        ? unknownError.message || '사용자 정보를 불러오지 못했습니다.'
        : '사용자 정보를 불러오지 못했습니다.';

    return (
      <Container pageTitle="블로그 허브" pageBack="/hub">
        <div className="container">
          <div className={`content ${styles.content} ${styles['hub-content']}`}>
            <ScreenState kind="error">{errorMessage}</ScreenState>
          </div>
        </div>
      </Container>
    );
  }

  if (!result.isLoggedIn) {
    return null;
  }

  const joinSites = Array.isArray(result.joinSites) ? result.joinSites : [];
  const statusSites = Array.isArray(result.statusSites) ? result.statusSites : [];
  const hasBlog = joinSites.some((site) => site.site_type === 'blog');
  const [favorites, liked, saved, read, owned] = await listsPromise;

  return (
    <Container pageTitle="블로그 허브" pageBack="/hub">
      <div className="container">
        <Content>
          <MemberStatusSites siteType="blog" statusSites={statusSites} />
          {joinSites.length > 0 && hasBlog ? (
            <JoinSites siteType="blog" joinSites={joinSites} />
          ) : (
            <section className={`paper ${styles.paper}`}>
              <div className="paper page-info">
                <ServiceNoDataIcon />
                <p>참여중인 블로그가 없어요 🫠</p>
              </div>
            </section>
          )}
          <FavoriteBlogList initialData={favorites.data} initialError={favorites.error} />
          <Liked siteType="blog" initialData={liked.data} initialError={liked.error} />
          <PostHistory siteType="blog" type="saved" initialData={saved.data} initialError={saved.error} />
          <PostHistory siteType="blog" type="read" initialData={read.data} initialError={read.error} />
          <OwnedDonationPosts siteType="blog" initialData={owned.data} initialError={owned.error} />
        </Content>
      </div>
    </Container>
  );
}
