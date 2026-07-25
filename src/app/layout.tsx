import { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Noto_Sans_KR, Noto_Serif_KR, Hahmlet } from 'next/font/google';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v13-appRouter';
import ThemeProviderClient from './themeProvider';
import AuthStateProvider from '@/components/auth/AuthStateProvider';
import TotpGuard from '@/components/auth/TotpGuard';
import WithdrawalGuard from '@/components/auth/WithdrawalGuard';
import './globals.sass';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

const Sans = Noto_Sans_KR({
  subsets: ['cyrillic'],
  variable: '--sans',
});

const Serif = Noto_Serif_KR({
  subsets: ['cyrillic'],
  variable: '--serif',
});

const Ham = Hahmlet({
  subsets: ['latin'],
  variable: '--ham',
});

const Pre = localFont({
  src: './fonts/PretendardVariable.woff2',
  style: 'normal',
  variable: '--pre',
});

const Neo = localFont({
  src: './fonts/NanumSquareNeoVF.woff2',
  style: 'normal',
  variable: '--neo',
});

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

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko-KR" className={`${Pre.variable} ${Neo.variable} ${Sans.variable} ${Serif.variable} ${Ham.variable}`}>
      <body>
        <div id="__app">
          <AuthStateProvider>
            <AppRouterCacheProvider>
              <ThemeProviderClient>
                <WithdrawalGuard>
                  <TotpGuard>{children}</TotpGuard>
                </WithdrawalGuard>
              </ThemeProviderClient>
            </AppRouterCacheProvider>
          </AuthStateProvider>
        </div>
      </body>
    </html>
  );
}
