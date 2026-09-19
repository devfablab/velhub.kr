import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { originTitle, Seo } from '@/lib/seo';
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
    const cookieStore = await cookies();
    const headerList = await headers();
    const response = await fetch(
      `${headerList.get('x-forwarded-proto') || 'http'}://${headerList.get('host')}/api/settlement`,
      {
        headers: { cookie: cookieStore.toString() },
        cache: 'no-store',
      },
    );
    const result = (await response.json()) as SettlementResponse & { message?: string };
    if (!response.ok) throw new Error(result.message ?? '정산 정보를 불러오지 못했습니다.');
    initialData = result;
  } catch (error) {
    initialError = error instanceof Error ? error.message : '정산 정보를 불러오지 못했습니다.';
  }
  return <Opt initialData={initialData} initialError={initialError} />;
}
