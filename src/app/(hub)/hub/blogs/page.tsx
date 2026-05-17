import { cookies, headers } from 'next/headers';
import JoinSites from '../shared/joinSites';
import styles from '@/app/hub.module.sass';

type JoinSiteRow = {
  id: string;
  site_key: string;
  site_label: string;
  site_type: string;
  avatar: string | null;
  role: string;
};

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

  const response = await fetch(`${baseUrl}/api/home/user-join-sites`, {
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

  if (joinSites.length === 0) {
    return null;
  }

  const hasBlog = joinSites.some((site) => site.site_type === 'blog');
  const hasCommunity = joinSites.some((site) => site.site_type === 'community');

  if (!hasBlog && !hasCommunity) {
    return null;
  }

  return (
    <main>
      <div className="container">
        <div className={`content ${styles.content} ${styles['hub-content']}`}>
          {hasBlog ? <JoinSites siteType="blog" joinSites={joinSites} /> : null}
        </div>
      </div>
    </main>
  );
}
