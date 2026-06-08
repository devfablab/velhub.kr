import { headers } from 'next/headers';
import Container from '../../menu';
import Aside from '../aside';
import Slick from '../slick';
import List from '../list';
import styles from '@/app/page.module.sass';

export default async function BlogHub() {
  const headerList = await headers();
  const host = headerList.get('host');
  const protocol = headerList.get('x-forwarded-proto') || 'http';
  const baseUrl = `${protocol}://${host}`;
  let sitesHitsData = null;
  let postsHitsData = null;
  try {
    const sitesHitsResponse = await fetch(`${baseUrl}/api/home/sites?limit=10&sortBy=post_count&siteType=community`, {
      cache: 'no-store',
    });

    if (!sitesHitsResponse.ok) {
      console.error('Sites API Error:', sitesHitsResponse.status, await sitesHitsResponse.text());
    } else {
      sitesHitsData = await sitesHitsResponse.json();
    }

    const postsHitsResponse = await fetch(`${baseUrl}/api/home/posts?limit=20&sortBy=post_count&siteType=community`, {
      cache: 'no-store',
    });

    if (!postsHitsResponse.ok) {
      console.error('Posts API Error:', postsHitsResponse.status, await postsHitsResponse.text());
    } else {
      postsHitsData = await postsHitsResponse.json();
    }
  } catch (error) {
    console.error('Fetch Failed:', error);
  }

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <section>
            <h2>핫한 커뮤니티를 모았어요 💃</h2>
            <Slick sitesHitsData={sitesHitsData} />
          </section>
          <section>
            <h2>인기 포스팅 🥰</h2>
            <Slick postsData={postsHitsData} isHub={true} />
          </section>
          <section>
            <h2>많은 분들이 읽었어요 😎</h2>
            <List postsData={postsHitsData} orderType="hits" />
          </section>
        </div>
        <Aside />
      </div>
    </Container>
  );
}
