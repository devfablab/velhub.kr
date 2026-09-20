import { getSiteApiData } from '../../getSiteApiData';
import type { RevenueListResponse, RevenueListType } from './RevenueList';
import type { RevenueSummaryResponse } from './RevenueSummary';

export function getRevenueSummary(siteName: string) {
  return getSiteApiData<RevenueSummaryResponse>(
    `/api/revenue/summary?siteName=${siteName}`,
    '수익정산 홈 정보를 불러오지 못했습니다.',
  );
}

export function getRevenueList(
  siteName: string,
  type: RevenueListType,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const query = new URLSearchParams({
    siteName,
    page: typeof searchParams.page === 'string' ? searchParams.page : '1',
    pageSize: '20',
  });
  ['rangeType', 'year', 'quarter', 'half', 'startYear', 'startMonth', 'endYear', 'endMonth'].forEach((key) => {
    const value = searchParams[key];
    if (typeof value === 'string' && value) query.set(key, value);
  });
  return getSiteApiData<RevenueListResponse>(`/api/revenue/${type}?${query.toString()}`, '내역을 불러오지 못했습니다.');
}
