'use client';

import { createContext, useContext } from 'react';

export type LoungeHeaderData = {
  isLoggedIn: boolean;
  email: string | null;
  userName: string | null;
  avatar: string | null;
  isAuthor?: boolean;
  creatorHandleName?: string | null;
  userHandleName?: string | null;
  hasAffettoMyPosts?: boolean;
};

const LoungeHeaderContext = createContext<LoungeHeaderData | null>(null);

export function LoungeHeaderProvider({
  children,
  value,
}: Readonly<{
  children: React.ReactNode;
  value: LoungeHeaderData | null;
}>) {
  return <LoungeHeaderContext.Provider value={value}>{children}</LoungeHeaderContext.Provider>;
}

export function useLoungeHeader() {
  return useContext(LoungeHeaderContext);
}
