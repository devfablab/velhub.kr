import Container from '../../menu';
import MembershipSelectors from './opt';

export default function Page() {
  return (
    <Container pageTitle="라운지 노출 대상 선택" pageBack="/hub/memberships/plan">
      <MembershipSelectors />
    </Container>
  );
}
