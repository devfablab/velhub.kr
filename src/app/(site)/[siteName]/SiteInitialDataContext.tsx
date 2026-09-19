'use client';

import { createContext, useContext } from 'react';

type Board = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: 'blog' | 'page' | 'basic' | 'gallery' | 'youtube' | 'feed';
  is_active: boolean;
};

type InitialData = {
  boards: Board[];
  writeBoards: Board[];
  postCountContents: Array<{ id: string; slug: string; subject: string; board_key: string; post_count: number; comment_count: number }>;
  communitySiteInfo: unknown;
  communityLinks: unknown[];
  communityUserInfo: unknown;
  blogProfile: unknown;
};

const SiteInitialDataContext = createContext<InitialData | null>(null);

export function SiteInitialDataProvider({ children, value }: { children: React.ReactNode; value: InitialData | null }) {
  return <SiteInitialDataContext.Provider value={value}>{children}</SiteInitialDataContext.Provider>;
}

export function useSiteInitialData() {
  return useContext(SiteInitialDataContext);
}
