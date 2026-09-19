import { Metadata } from 'next';
import Container from '../../menu';
import { getHubApiData } from '../../shared/getHubApiData';
import ReadsItems, { ReadsResponse } from '../../shared/readsItems';
import Content from '../tab';

export const metadata: Metadata = {
  title: '커뮤니티 허브 - 마이허브 - 데브허브',
  description: '커뮤니티 허브',
};

export default async function Page() {
  const result = await getHubApiData<ReadsResponse>(
    '/api/hub/read-posts?siteType=community&limit=100',
    '읽은 글 목록을 불러오지 못했습니다.',
  );
  return (
    <Container pageTitle="커뮤니티 허브" pageBack="/hub">
      <div className="container">
        <Content>
          <ReadsItems siteType="community" initialData={result.data} initialError={result.error} />
        </Content>
      </div>
    </Container>
  );
}
