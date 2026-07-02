import Container from '../../menu';
import RevenueListPage from '../RevenueList';

export default function Page() {
  return (
    <Container pageTitle="전체 거래 내역">
      <RevenueListPage type="transactions" />
    </Container>
  );
}
