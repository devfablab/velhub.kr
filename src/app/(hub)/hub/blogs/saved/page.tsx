import { Metadata } from 'next';
import Container from '../../menu';
import { getHubApiData } from '../../shared/getHubApiData';
import SavedItems, { SavedResponse } from '../../shared/savedItems';
import Content from '../tab';

export const metadata: Metadata = {
  title: '블로그 허브 - 마이허브 - 데브허브',
  description: '블로그 허브',
};

export default async function Page() {
  const result = await getHubApiData<SavedResponse>(
    '/api/hub/saved-posts?siteType=blog&limit=100',
    '저장한 글 목록을 불러오지 못했습니다.',
  );
  return (
    <Container pageTitle="블로그 허브" pageBack="/hub">
      <div className="container">
        <Content>
          <SavedItems siteType="blog" initialData={result.data} initialError={result.error} />
        </Content>
      </div>
    </Container>
  );
}
