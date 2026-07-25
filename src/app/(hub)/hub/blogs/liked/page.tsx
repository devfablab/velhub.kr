import { Metadata } from 'next';
import Content from '../tab';
import LikedItems from '../../shared/likedItems';
import Container from '../../menu';

export const metadata: Metadata = {
  title: '블로그 허브 - 마이허브 - 데브허브',
  description: '블로그 허브',
};

export default function Page() {
  return (
    <Container pageTitle="블로그 허브" pageBack="/hub">
      <div className="container">
        <Content>
          <LikedItems siteType="blog" />
        </Content>
      </div>
    </Container>
  );
}
