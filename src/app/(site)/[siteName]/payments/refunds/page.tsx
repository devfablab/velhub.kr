import Container from '../../menu';
import RevenueList from '../RevenueList';

export default function Page() {
  return (
    <Container pageTitle="전체 환불 내역">
      <RevenueList type="refunds" />
    </Container>
  );
}
