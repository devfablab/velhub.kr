import Content from '../tab';
import ReadsItems from '../../shared/readsItems';
import Container from '../../menu';

export default function Page() {
  return (
    <Container pageTitle="블로그 허브" pageBack="/hub">
      <div className="container">
        <Content>
          <ReadsItems siteType="blog" />
        </Content>
      </div>
    </Container>
  );
}
