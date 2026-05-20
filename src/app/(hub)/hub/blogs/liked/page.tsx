import Content from '../tab';
import LikedItems from '../../shared/likedItems';
import Container from '../../menu';

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
