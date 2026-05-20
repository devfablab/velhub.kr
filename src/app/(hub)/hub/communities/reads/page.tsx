import Content from '../tab';
import ReadsItems from '../../shared/readsItems';
import Container from '../../menu';

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
