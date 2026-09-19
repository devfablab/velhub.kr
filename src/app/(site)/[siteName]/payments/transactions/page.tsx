import Container from '../../menu';
import { getRevenueList } from '../getInitialData';
import RevenueListPage from '../RevenueList';

export default async function Page({ params, searchParams }: { params: Promise<{ siteName: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { siteName } = await params;
  const initial = await getRevenueList(siteName, 'transactions', await searchParams);
  return (
    <Container pageTitle="전체 거래 내역">
      <RevenueListPage type="transactions" initialData={initial.data} initialError={initial.error} />
    </Container>
  );
}
