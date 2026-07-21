import Container from '../menu';
import RevenueHub from './opt';

export default function Page() {
  return (
    <Container pageTitle="수입/정산" pageBack="/hub">
      <RevenueHub />
    </Container>
  );
}
