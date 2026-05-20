import Content from '../tab';
import LikedItems from '../../shared/likedItems';
import Container from '../../menu';

export default function Page() {
  return (
    <Container pageTitle="커뮤니티 허브" pageBack="/hub">
      <div className="container">
        <Content>
          <LikedItems siteType="community" />
        </Content>
      </div>
    </Container>
  );
}
