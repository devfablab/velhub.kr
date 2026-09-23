'use client';

import { createContext, useContext } from 'react';

export type ConciergeHeaderData = {
  isLoggedIn: boolean;
  email: string | null;
  userName: string | null;
  avatar: string | null;
  themeMode: 'light' | 'system' | 'dark' | null;
  globalRole: string | null;
  isAuthor?: boolean;
  creatorHandleName?: string | null;
  userHandleName?: string | null;
  hasAffettoMyPosts?: boolean;
};

const ConciergeHeaderContext = createContext<ConciergeHeaderData | null>(null);

export function ConciergeHeaderProvider({
  children,
  value,
}: Readonly<{
  children: React.ReactNode;
  value: ConciergeHeaderData | null;
}>) {
  return <ConciergeHeaderContext.Provider value={value}>{children}</ConciergeHeaderContext.Provider>;
}

export function useConciergeHeader() {
  return useContext(ConciergeHeaderContext);
}
