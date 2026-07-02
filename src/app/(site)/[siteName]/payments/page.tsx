import Container from '../menu';
import RevenueSummary from './RevenueSummary';

export default function Page() {
  return (
    <Container pageTitle="수익정산 홈">
      <RevenueSummary />
    </Container>
  );
}
