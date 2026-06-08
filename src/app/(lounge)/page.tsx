import { headers } from 'next/headers';
import Container from './menu';
import Aside from './lounge/aside';
import Slick from './lounge/slick';
import List from './lounge/list';
import styles from '../page.module.sass';

type SiteItem = {
  site_key: string;
  site_label: string;
  profile_picture: string | null;
  summary: string | null;
  site_type: string;
  profile_logo: string | null;
  created_at: string;
};

type SitesCreatedData = {
  site_key: string;
  site_label: string;
  summary: string | null;
  site_type: string;
  created_at: string;
};

type SitesHitsData = {
  site_key: string;
  site_label: string;
  profile_picture: string | null;
  summary: string | null;
  site_type: string;
  profile_logo: string | null;
  post_count: number | null;
  member_count: number | null;
};

type GalleryPost = {
  site_key: string;
  site_label: string;
  site_type: string;
  profile_picture: string | null;
  slug: string;
  board_key: string;
  board_type: 'gallery';
  author_name: string;
  author_avatar: string | null;
  published_at: string;

  subject: string;
  summary: string | null;
  content_html: string;
  image: string;
  post_count: number | null;
};

type YoutubePost = {
  site_key: string;
  site_label: string;
  site_type: string;
  profile_picture: string | null;
  slug: string;
  board_key: string;
  board_type: 'youtube';
  author_name: string;
  author_avatar: string | null;
  published_at: string;

  subject: string;
  summary: string;
  thumbnail_image: string | null;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
  youtube_id: string;
  youtube_created_at: string | null;
  post_count: number | null;
};

type FeedPost = {
  site_key: string;
  site_label: string;
  site_type: string;
  profile_picture: string | null;
  slug: string;
  board_key: string;
  board_type: 'feed';
  author_name: string;
  author_avatar: string | null;
  published_at: string;

  content_simple: string;
  image: string | null;
  post_count: number | null;
};

type BasicOrBlogPost = {
  site_key: string;
  site_label: string;
  site_type: string;
  profile_picture: string | null;
  slug: string;
  board_key: string;
  board_type: 'basic' | 'blog';
  author_name: string;
  author_avatar: string | null;
  published_at: string;
  thumbnail_image: string | null;
  subject: string;
  content_html: string;
  post_count: number | null;
};

type PostItem = GalleryPost | YoutubePost | FeedPost | BasicOrBlogPost;

type SitesResponse = {
  sites: SiteItem[];
};

type sitesCreatedResponse = {
  sites: SitesCreatedData[];
};

type sitesHitsResponse = {
  sites: SitesHitsData[];
};

type PostsResponse = {
  posts: PostItem[];
};

export type SlickProps = {
  sitesData?: SitesResponse;
  sitesCreatedData?: sitesCreatedResponse;
  sitesHitsData?: sitesHitsResponse;
  postsData?: PostsResponse;
  isHub?: boolean;
};

export type ListProps = {
  postsData?: PostsResponse;
  orderType?: 'newest' | 'hits';
};

export default async function Home() {
  const headerList = await headers();
  const host = headerList.get('host');
  const protocol = headerList.get('x-forwarded-proto') || 'http';
  const baseUrl = `${protocol}://${host}`;
  let sitesCreatedData = null;
  let postsPublishedData = null;
  try {
    const sitesCreatedResponse = await fetch(`${baseUrl}/api/home/sites?limit=10&sortBy=created_at`, {
      cache: 'no-store',
    });

    if (!sitesCreatedResponse.ok) {
      console.error('Sites API Error:', sitesCreatedResponse.status, await sitesCreatedResponse.text());
    } else {
      sitesCreatedData = await sitesCreatedResponse.json();
    }

    const postsPublishedResponse = await fetch(`${baseUrl}/api/home/posts?limit=20`, {
      cache: 'no-store',
    });

    if (!postsPublishedResponse.ok) {
      console.error('Posts API Error:', postsPublishedResponse.status, await postsPublishedResponse.text());
    } else {
      postsPublishedData = await postsPublishedResponse.json();
    }
  } catch (error) {
    console.error('Fetch Failed:', error);
  }

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <section>
            <h2>새로 오픈했어요 👋</h2>
            <Slick sitesCreatedData={sitesCreatedData} />
          </section>
          <section>
            <h2>새로운 글 알리미! 🥰</h2>
            <Slick postsData={postsPublishedData} />
          </section>
          <section>
            <h2>여러분의 관심이 필요해요 🥹</h2>
            <List postsData={postsPublishedData} orderType="newest" />
          </section>
        </div>
        <Aside />
      </div>
    </Container>
  );
}
