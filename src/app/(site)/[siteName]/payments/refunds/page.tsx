import Container from '../../menu';
import { getRevenueList } from '../getInitialData';
import RevenueList from '../RevenueList';

export default async function Page({ params, searchParams }: { params: Promise<{ siteName: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { siteName } = await params;
  const initial = await getRevenueList(siteName, 'refunds', await searchParams);
  return (
    <Container pageTitle="전체 환불 내역">
      <RevenueList type="refunds" initialData={initial.data} initialError={initial.error} />
    </Container>
  );
}
