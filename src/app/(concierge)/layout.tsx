import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import Footer from '@/components/footers/Footer';
import HeaderConcierge from '@/components/headers/Concierge';
import ChannelWorks from '@/components/service/common/ChannelWorks';
import { ConciergeHeaderProvider, type ConciergeHeaderData } from './ConciergeHeaderContext';

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

async function getHeaderData(): Promise<ConciergeHeaderData | null> {
  try {
    const cookieStore = await cookies();
    const headerList = await headers();
    const host = headerList.get('host');
    const protocol = headerList.get('x-forwarded-proto') || 'http';

    if (!host) {
      return null;
    }

    const response = await fetch(`${protocol}://${host}/api/header/lounge`, {
      headers: { cookie: cookieStore.toString() },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as ConciergeHeaderData;
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
    <ConciergeHeaderProvider value={header}>
      <HeaderConcierge />
      {children}
      <Footer />
      <ChannelWorks />
    </ConciergeHeaderProvider>
  );
}
