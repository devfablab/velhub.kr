import Container from '../menu';
import { getRevenueSummary } from './getInitialData';
import RevenueSummary from './RevenueSummary';

export default async function Page({ params }: { params: Promise<{ siteName: string }> }) {
  const { siteName } = await params;
  const initial = await getRevenueSummary(siteName);
  return (
    <Container pageTitle="수익정산 홈">
      <RevenueSummary initialData={initial.data} initialError={initial.error} />
    </Container>
  );
}
