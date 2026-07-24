import type { Metadata } from 'next';
import HeaderHub from '@/components/headers/Hub';
import Footer from '@/components/footers/Footer';

export const metadata: Metadata = {
  title: '마이허브',
  description: '마이허브 페이지',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <HeaderHub />
      {children}
      <Footer />
    </>
  );
}
