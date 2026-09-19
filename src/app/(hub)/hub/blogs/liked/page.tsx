import { Metadata } from 'next';
import Container from '../../menu';
import { getHubApiData } from '../../shared/getHubApiData';
import LikedItems, { LikedItemsResponse } from '../../shared/likedItems';
import Content from '../tab';

export const metadata: Metadata = {
  title: '블로그 허브 - 마이허브 - 데브허브',
  description: '블로그 허브',
};

export default async function Page() {
  const result = await getHubApiData<LikedItemsResponse>(
    '/api/hub/liked?siteType=blog&limit=100',
    '좋아요 목록을 불러오지 못했습니다.',
  );
  return (
    <Container pageTitle="블로그 허브" pageBack="/hub">
      <div className="container">
        <Content>
          <LikedItems siteType="blog" initialData={result.data} initialError={result.error} />
        </Content>
      </div>
    </Container>
  );
}
