import type { Metadata } from 'next';
import { originTitle, Seo } from '@/lib/seo';
import Opt from './opt';

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

export default function Page() {
  return <Opt />;
}
