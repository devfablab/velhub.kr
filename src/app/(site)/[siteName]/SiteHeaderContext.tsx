'use client';

import { createContext, useContext } from 'react';

export type SiteHeaderData = {
  siteName: string | null;
  siteLabel: string | null;
  siteType: 'blog' | 'community' | null;
  themeType: string;
  profilePictureUrl: string | null;
  profileLogoUrl: string | null;
  blogFontSettings: {
    subjectFontFamily: string | null;
    subjectLetterSpacing: number | null;
    subjectLineHeight: number | null;
    descriptionFontFamily: string | null;
    descriptionLetterSpacing: number | null;
    descriptionLineHeight: number | null;
    descriptionFontSize: number | null;
    descriptionMargin: number | null;
  } | null;
  isLoggedIn: boolean;
  email: string | null;
  userName: string | null;
  avatar: string | null;
  globalRole: string | null;
  siteRole: string | null;
  siteRoleLabels: string[];
  nickname: string | null;
  isApproval: boolean | null;
  invite: boolean;
  join: boolean;
  sessionCase?: string | null;
  isAuthor?: boolean;
  creatorHandleName?: string | null;
  userHandleName?: string | null;
  hasAffettoMyPosts?: boolean;
};

const SiteHeaderContext = createContext<SiteHeaderData | null>(null);

export function SiteHeaderProvider({ children, value }: { children: React.ReactNode; value: SiteHeaderData | null }) {
  return <SiteHeaderContext.Provider value={value}>{children}</SiteHeaderContext.Provider>;
}

export function useSiteHeader() {
  return useContext(SiteHeaderContext);
}
