'use client';

import { createContext, useContext } from 'react';

export type HubHeaderData = {
  isLoggedIn: boolean;
  email: string | null;
  userName: string | null;
  avatar: string | null;
  globalRole: string | null;
  isAuthor?: boolean;
  creatorHandleName?: string | null;
  userHandleName?: string | null;
  hasAffettoMyPosts?: boolean;
};

const HubHeaderContext = createContext<HubHeaderData | null>(null);

export function HubHeaderProvider({
  children,
  value,
}: Readonly<{
  children: React.ReactNode;
  value: HubHeaderData;
}>) {
  return <HubHeaderContext.Provider value={value}>{children}</HubHeaderContext.Provider>;
}

export function useHubHeader() {
  return useContext(HubHeaderContext);
}
