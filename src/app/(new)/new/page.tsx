import { Metadata } from 'next';
import { originTitle, Seo } from '@/lib/seo';
import Opt from './opt';

export async function generateMetadata(): Promise<Metadata> {
  const timestamp = Date.now();

  return Seo({
    pageTitles: `사이트 개설 - ${originTitle}`,
    pageTitle: `사이트 개설`,
    pageDescription: `사이트를 개설할 수 있어요`,
    pageImg: `https://velhub.xyz/og-etc.webp?ts=${timestamp}`,
    pagePath: '/new',
  });
}

export default function Page() {
  return <Opt />;
}
