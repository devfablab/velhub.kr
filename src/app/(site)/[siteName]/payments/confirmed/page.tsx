import Container from '../../menu';
import { getRevenueList } from '../getInitialData';
import RevenueList from '../RevenueList';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ siteName: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteName } = await params;
  const initial = await getRevenueList(siteName, 'confirmed', await searchParams);
  return (
    <Container pageTitle="정산 확정">
      <RevenueList type="confirmed" initialData={initial.data} initialError={initial.error} />
    </Container>
  );
}
