import type { Metadata } from 'next';
import HeaderSettings from '@/components/headers/Settings';

export const metadata: Metadata = {
  title: '개인설정',
  description: '개인설정 페이지',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <HeaderSettings />
      {children}
    </>
  );
}
