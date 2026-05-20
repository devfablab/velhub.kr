import Content from '../tab';
import SavedItems from '../../shared/savedItems';
import Container from '../../menu';

export default function Page() {
  return (
    <Container pageTitle="블로그 허브" pageBack="/hub">
      <div className="container">
        <Content>
          <SavedItems siteType="blog" />
        </Content>
      </div>
    </Container>
  );
}
