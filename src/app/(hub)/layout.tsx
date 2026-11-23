import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import { fetchApiRoute } from '@/lib/service/site/siteApiRoutes';
import ChannelWorks from '@/components/ChannelWorks';
import Footer from '@/components/footers/Footer';
import HeaderHub from '@/components/headers/Hub';
import { HubHeaderProvider, type HubHeaderData } from './hub/shared/headerContext';

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

async function getHeaderData(): Promise<HubHeaderData | null> {
  try {
    const response = await fetchApiRoute('/api/header/settings');

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as HubHeaderData;
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

  if (!header) {
    redirect('/auth/sign-in');
  }

  return (
    <HubHeaderProvider value={header}>
      <a href="#content" className="sr-only">
        본문영역 바로가기
      </a>
      <hr id="header" />
      <HeaderHub />
      <hr id="content" />
      {children}
      <a href="#header" className="sr-only">
        메뉴영역 바로가기
      </a>
      <Footer />
      <ChannelWorks />
    </HubHeaderProvider>
  );
}
