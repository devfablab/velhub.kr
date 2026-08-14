import { Metadata } from 'next';
import Container from '../../menu';
import ReadsItems from '../../shared/readsItems';
import Content from '../tab';

export const metadata: Metadata = {
  title: '커뮤니티 허브 - 마이허브 - 데브허브',
  description: '커뮤니티 허브',
};

export default function Page() {
  return (
    <Container pageTitle="커뮤니티 허브" pageBack="/hub">
      <div className="container">
        <Content>
          <ReadsItems siteType="community" />
        </Content>
      </div>
    </Container>
  );
}
