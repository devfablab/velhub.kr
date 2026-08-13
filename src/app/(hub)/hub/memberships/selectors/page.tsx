import Container from '../../menu';
import Content from '../tab';
import MembershipSelectors from './opt';

export default function Page() {
  return (
    <Container pageTitle="라운지 노출 대상 선택" pageBack="/hub">
      <div className="container">
        <Content>
          <MembershipSelectors />
        </Content>
      </div>
    </Container>
  );
}
