import type { Metadata } from 'next';
import { originTitle, Seo } from '@/lib/seo';
import Opt from './opt';

export async function generateMetadata(): Promise<Metadata> {
  const timestamp = Date.now();

  return Seo({
    pageTitles: `창작자 멤버십 가입 - ${originTitle}`,
    pageTitle: '창작자 멤버십 가입',
    pageDescription: '데브허브 창작자 멤버십을 선택해 주세요.',
    pageImg: `https://velhub.xyz/og-etc.webp?ts=${timestamp}`,
    pagePath: '/memberships/creator',
  });
}

export default function Page() {
  return <Opt />;
}
