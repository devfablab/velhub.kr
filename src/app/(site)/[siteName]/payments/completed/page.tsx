import Container from '../../menu';
import RevenueList from '../RevenueList';

export default function Page() {
  return (
    <Container pageTitle="정산 완료">
      <RevenueList type="completed" />
    </Container>
  );
}
