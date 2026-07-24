import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '인증',
  description: '인증 페이지',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
