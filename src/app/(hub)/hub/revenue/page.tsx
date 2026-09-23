import { Metadata } from 'next';
import type { SettlementResponse } from '@/components/service/common/SettlementForm';
import Container from '../menu';
import { getHubApiData } from '../shared/getHubApiData';
import RevenueHub, { RevenueSitesResponse } from './opt';
import type { RevenueSummaryResponse } from '@/app/(site)/[siteName]/payments/RevenueSummary';

export const metadata: Metadata = {
  title: '수입/정산 - 마이허브 - 데브허브',
  description: '수입/정산',
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const sites = await getHubApiData<RevenueSitesResponse>(
    '/api/hub/revenue/sites',
    '수입/정산 사이트를 불러오지 못했습니다.',
  );
  const requestedSiteName = typeof query.siteName === 'string' ? query.siteName : '';
  const selectedSiteName = sites.data?.sites?.some((site) => site.siteName === requestedSiteName)
    ? requestedSiteName
    : (sites.data?.sites?.[0]?.siteName ?? '');
  const [summary, settlement] = await Promise.all([
    selectedSiteName
      ? getHubApiData<RevenueSummaryResponse>(
          `/api/hub/revenue/summary?siteName=${encodeURIComponent(selectedSiteName)}`,
          '수익정산 홈 정보를 불러오지 못했습니다.',
        )
      : Promise.resolve({ data: null, error: '' }),
    getHubApiData<SettlementResponse>('/api/settlement', '정산 정보를 불러오지 못했습니다.'),
  ]);

  return (
    <Container pageTitle="수입/정산" pageBack="/hub">
      <RevenueHub
        initialData={sites.data}
        initialError={sites.error}
        initialSummary={summary.data}
        initialSummaryError={summary.error}
        initialSettlement={settlement.data}
        initialSettlementError={settlement.error}
      />
    </Container>
  );
}
