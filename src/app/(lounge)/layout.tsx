import type { Metadata, Viewport } from 'next';
import ChannelWorks from '@/components/ChannelWorks';
import Footer from '@/components/footers/Footer';
import HeaderLounge from '@/components/headers/Lounge';
import { LoungeHeaderProvider, type LoungeHeaderData } from './lounge/shared/LoungeHeaderContext';
import { fetchApiRoute } from '@/lib/service/site/siteApiRoutes';

export const metadata: Metadata = {
  applicationName: '데브허브',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '데브허브',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon/favicon.ico', rel: 'shortcut icon' },
    ],
    apple: '/favicon/apple-touch-icon.png',
  },
  manifest: '/favicon/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#EEB400',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  userScalable: false,
  colorScheme: 'light',
};

async function getHeaderData(): Promise<LoungeHeaderData | null> {
  try {
    const response = await fetchApiRoute('/api/header/lounge');

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as LoungeHeaderData;
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const header = await getHeaderData();

  return (
    <LoungeHeaderProvider value={header}>
      <a href="#content" className="sr-only">
        본문영역 바로가기
      </a>
      <hr id="header" />
      <HeaderLounge />
      <hr id="content" />
      {children}
      <a href="#header" className="sr-only">
        메뉴영역 바로가기
      </a>
      <Footer />
      <ChannelWorks />
    </LoungeHeaderProvider>
  );
}
