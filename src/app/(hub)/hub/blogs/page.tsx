import { cookies, headers } from 'next/headers';
import JoinSites, { JoinSiteRow } from '../shared/joinSites';
import Liked from '../shared/liked';
import PostHistory from '../shared/postHistory';
import FavoriteBlogs from './favoriteBlogs';
import Container from './tab';
import styles from '@/app/hub.module.sass';

type UserResponse = {
  isLoggedIn: boolean;
  role: string | null;
  joinSites: JoinSiteRow[];
  error?: string;
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
      <main>
        <div className="container">
          <div className={`content ${styles['hub-content']}`}>
            <p>{errorMessage}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!result.isLoggedIn) {
    return null;
  }

  const joinSites = Array.isArray(result.joinSites) ? result.joinSites : [];

  const hasBlog = joinSites.some((site) => site.site_type === 'blog');

  return (
    <main>
      <div className="container">
        <Container>
          {joinSites.length > 0 && hasBlog ? (
            <JoinSites siteType="blog" joinSites={joinSites} />
          ) : (
            <section className={`paper ${styles.paper}`}>
              <p>참여중인 블로그가 없어요 🫠</p>
            </section>
          )}
          <FavoriteBlogs />
          <Liked siteType="blog" />
          <PostHistory siteType="blog" type="saved" />
          <PostHistory siteType="blog" type="read" />
        </Container>
      </div>
    </main>
  );
}
