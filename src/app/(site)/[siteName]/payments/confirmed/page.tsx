import Container from '../../menu';
import RevenueList from '../RevenueList';

export default function Page() {
  return (
    <Container pageTitle="정산 확정">
      <RevenueList type="confirmed" />
    </Container>
  );
}
