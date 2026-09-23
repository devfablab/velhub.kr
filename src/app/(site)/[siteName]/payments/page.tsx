import type { SettlementResponse } from '@/components/service/common/SettlementForm';
import { getSiteApiData } from '../../getSiteApiData';
import Container from '../menu';
import { getRevenueSummary } from './getInitialData';
import RevenueSummary from './RevenueSummary';

export default async function Page({ params }: { params: Promise<{ siteName: string }> }) {
  const { siteName } = await params;
  const [initial, settlement] = await Promise.all([
    getRevenueSummary(siteName),
    getSiteApiData<SettlementResponse>('/api/settlement', '정산 정보를 불러오지 못했습니다.'),
  ]);
  return (
    <Container pageTitle="수익정산 홈">
      <RevenueSummary
        initialData={initial.data}
        initialError={initial.error}
        initialSettlement={settlement.data}
        initialSettlementError={settlement.error}
      />
    </Container>
  );
}
