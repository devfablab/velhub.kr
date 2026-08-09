import type { Metadata } from 'next';
import { originTitle, Seo } from '@/lib/seo';
import Opt from './opt';

export async function generateMetadata(): Promise<Metadata> {
  const timestamp = Date.now();

  return Seo({
    pageTitles: `독자 멤버십 가입 - ${originTitle}`,
    pageTitle: '독자 멤버십 가입',
    pageDescription: '데브허브 독자 멤버십을 선택해 주세요.',
    pageImg: `https://velhub.xyz/og-etc.webp?ts=${timestamp}`,
    pagePath: '/memberships/user',
  });
}

export default function Page() {
  return <Opt />;
}
