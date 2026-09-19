import { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { ServiceNoDataIcon } from '@/components/Svgs';
import Container from '../menu';
import JoinSites, { JoinSiteRow } from '../shared/joinSites';
import Liked, { LikedResponse } from '../shared/liked';
import MemberStatusSites, { MemberStatusSiteRow } from '../shared/memberStatusSites';
import OwnedDonationPosts, { PostsResponse as OwnedDonationPostsResponse } from '../shared/ownedDonationPosts';
import PostHistory, { PostsResponse } from '../shared/postHistory';
import FavoriteBlogs, { FavoriteBlogsResponse, Folder } from './favoriteBlogs';
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
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const headerList = await headers();
  const host = headerList.get('host');
  const protocol = headerList.get('x-forwarded-proto') || 'http';
  const baseUrl = `${protocol}://${host}`;

  const response = await fetch(`${baseUrl}/api/hub/user-join-sites`, {
    method: 'GET',
    headers: {
      cookie: cookieHeader,
    },
    cache: 'no-store',
  });

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
            <p>{errorMessage}</p>
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
  const cookieStore = await cookies();
  const headerList = await headers();
  const host = headerList.get('host');
  const protocol = headerList.get('x-forwarded-proto') || 'http';
  const baseUrl = `${protocol}://${host}`;
  const requestHeaders = { cookie: cookieStore.toString() };
  const load = async <T,>(path: string, fallback: string): Promise<{ data: T | null; error: string }> => {
    try {
      const response = await fetch(`${baseUrl}${path}`, { headers: requestHeaders, cache: 'no-store' });
      const data = (await response.json()) as T & { error?: string };
      if (!response.ok) throw new Error(data.error ?? fallback);
      return { data, error: '' };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : fallback };
    }
  };
  const [favorites, folders, liked, saved, read, owned] = await Promise.all([
    load<FavoriteBlogsResponse>('/api/hub/blog-favorites', '즐겨찾는 블로그를 불러오지 못했습니다.'),
    load<{ folders?: Folder[] }>('/api/hub/favorite-folders', '폴더를 불러오지 못했습니다.'),
    load<LikedResponse>('/api/hub/liked?siteType=blog&limit=3', '좋아요 목록을 불러오지 못했습니다.'),
    load<PostsResponse>('/api/hub/saved-posts?siteType=blog&limit=3', '저장한 글을 불러오지 못했습니다.'),
    load<PostsResponse>('/api/hub/read-posts?siteType=blog&limit=3', '읽은 글을 불러오지 못했습니다.'),
    load<OwnedDonationPostsResponse>(
      '/api/hub/owned-donation-posts?siteType=blog',
      '소장/후원글 목록을 불러오지 못했습니다.',
    ),
  ]);

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
          <FavoriteBlogs
            initialBlogs={favorites.data}
            initialFolders={folders.data}
            initialError={favorites.error || folders.error}
          />
          <Liked siteType="blog" initialData={liked.data} initialError={liked.error} />
          <PostHistory siteType="blog" type="saved" initialData={saved.data} initialError={saved.error} />
          <PostHistory siteType="blog" type="read" initialData={read.data} initialError={read.error} />
          <OwnedDonationPosts siteType="blog" initialData={owned.data} initialError={owned.error} />
        </Content>
      </div>
    </Container>
  );
}
