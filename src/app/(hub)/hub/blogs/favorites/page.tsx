import { Metadata } from 'next';
import { getHubApiData } from '@/lib/service/hub/getData';
import type { FavoriteBlogsResponse } from '@/lib/service/hubFavoriteFolder.shared';
import Container from '../../menu';
import FavoriteBlogs from '../favoriteBlogs';
import Content from '../tab';

export const metadata: Metadata = {
  title: '블로그 허브 - 마이허브 - 데브허브',
  description: '블로그 허브',
};

export default async function Page() {
  const result = await getHubApiData<FavoriteBlogsResponse>(
    '/api/hub/blog-favorites',
    '즐겨찾는 블로그를 불러오지 못했습니다.',
  );

  return (
    <Container pageTitle="블로그 허브" pageBack="/hub">
      <div className="container">
        <Content>
          <FavoriteBlogs initialData={result.data} initialError={result.error} />
        </Content>
      </div>
    </Container>
  );
}
