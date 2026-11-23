import type { Metadata } from 'next';
import { originTitle, Seo } from '@/lib/seo';
import { fetchApiRoute } from '@/lib/service/site/siteApiRoutes';
import Opt, { SettlementResponse } from './opt';

export async function generateMetadata(): Promise<Metadata> {
  const timestamp = Date.now();

  return Seo({
    pageTitles: `작가 신청 - ${originTitle}`,
    pageTitle: '작가 신청',
    pageDescription: '데브허브에서 수익 활동을 시작할 수 있어요',
    pageImg: `https://velhub.xyz/og-etc.webp?ts=${timestamp}`,
    pagePath: '/creator',
  });
}

export default async function Page() {
  let initialData: SettlementResponse | null = null;
  let initialError = '';
  try {
    const response = await fetchApiRoute('/api/settlement');
    const result = (await response.json()) as SettlementResponse & { message?: string };
    if (!response.ok) throw new Error(result.message ?? '정산 정보를 불러오지 못했습니다.');
    initialData = result;
  } catch (error) {
    initialError = error instanceof Error ? error.message : '정산 정보를 불러오지 못했습니다.';
  }
  return <Opt initialData={initialData} initialError={initialError} />;
}
