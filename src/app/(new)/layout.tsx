import type { Metadata } from 'next';
import { originTitle, Seo } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const timestamp = Date.now();

  return Seo({
    pageTitles: `사이트 개설 - ${originTitle}`,
    pageTitle: `사이트 개설`,
    pageDescription: `사이트를 개설합니다.`,
    pageImg: `https://velhub.xyz/og.webp?ts=${timestamp}`,
    pagePath: '/new',
  });
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
