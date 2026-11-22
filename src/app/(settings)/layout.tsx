import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { getSecurityState } from '@/lib/auth/securityCheck.server';
import { getSessionClaims } from '@/lib/session/server';
import SecurityCheckGuard from '@/components/auth/SecurityCheck';
import ChannelWorks from '@/components/ChannelWorks';
import HeaderSettings from '@/components/headers/Settings';

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

export default async function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sessionClaims = await getSessionClaims();
  const securityState = sessionClaims?.userId
    ? await getSecurityState(sessionClaims, await headers()).catch((error) => {
        console.error('[settings-layout] security state error', error);
        return null;
      })
    : null;
  const needsSettingsCheck = Boolean(
    sessionClaims?.userId && (!securityState || (!securityState.needsAccessCheck && !securityState.isSettingsVerified)),
  );

  return (
    <>
      <HeaderSettings />
      <SecurityCheckGuard needsCheck={needsSettingsCheck} purpose="settings">
        {children}
      </SecurityCheckGuard>
      <ChannelWorks />
    </>
  );
}
