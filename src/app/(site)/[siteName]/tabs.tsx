'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from '@mui/material/Link';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import { IconButton, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';

type Props = {
  pageTitle?: string;
};

type SiteType = 'blog' | 'community';

type HeaderSiteResponse = {
  siteName: string | null;
  siteType: SiteType | null;
  isLoggedIn: boolean;
  email: string | null;
  userName: string | null;
  avatar: string | null;
  themeMode: 'light' | 'system' | 'dark' | null;
  globalRole: string | null;
  siteRole: string | null;
  sessionCase?: string | null;
};

type StaffTabItem = {
  label: string;
  href: string;
  startsWith?: boolean;
};

function isStaffRole(role: string | null) {
  return role === 'owner' || role === 'manager';
}

function getTabValue(pathname: string, tabItems: StaffTabItem[]) {
  const exactMatchedItem = tabItems.find((tabItem) => pathname === tabItem.href);

  if (exactMatchedItem) {
    return exactMatchedItem.href;
  }

  const matchedItem = [...tabItems]
    .filter((tabItem) => pathname.startsWith(`${tabItem.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return matchedItem?.href ?? false;
}

function getMobileBackHref(pathname: string, siteName: string) {
  const segments = pathname.split('/').filter(Boolean);

  if (segments[0] !== siteName) {
    return `/${siteName}/manage`;
  }

  if (segments[1] !== 'contents' || segments[2] !== 'posts') {
    return `/${siteName}/manage`;
  }

  const depth = segments.length;

  if (depth === 4 && segments[3] === 'new') {
    return `/${siteName}/manage/contents/posts`;
  }

  if (depth === 4) {
    return `/${siteName}/manage/contents/posts`;
  }

  if (segments[3] !== 'c') {
    return `/${siteName}/manage`;
  }

  if (depth === 5 && segments[4] === 'new') {
    return `/${siteName}/manage/contents/posts/c`;
  }

  if (depth === 5) {
    return `/${siteName}/manage/contents/posts/c`;
  }

  if (depth === 6 && (segments[5] === 'new' || segments[5] === 'edit')) {
    return `/${siteName}/manage/contents/posts/c/${segments[4]}`;
  }

  if (depth === 6) {
    return `/${siteName}/manage/contents/posts/c/${segments[4]}`;
  }

  if (depth === 7 && segments[6] === 'edit') {
    return `/${siteName}/manage/contents/posts/c/${segments[4]}/${segments[5]}`;
  }

  return `/${siteName}/manage`;
}

function LinkTab({ label, href, value }: { label: string; href: string; value: string }) {
  return <Tab component={Link} href={href} underline="none" label={label} value={value} />;
}

export default function StaffTabs({ pageTitle }: Props) {
  const params = useParams();
  const pathname = usePathname();

  const siteName = normalizeText(params.siteName);
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));
  const isMobile = !isNotMobile;

  const [siteType, setSiteType] = useState<SiteType | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    async function loadHeader() {
      if (!siteName) {
        setIsReady(true);
        setIsAllowed(false);
        return;
      }

      const response = await fetch(`/api/header/site?siteName=${siteName}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as HeaderSiteResponse | { error?: string };

      if (!response.ok || !('siteRole' in result)) {
        setIsReady(true);
        setIsAllowed(false);
        return;
      }

      setSiteType(result.siteType);

      if (!isStaffRole(result.siteRole)) {
        setIsReady(true);
        setIsAllowed(false);
        return;
      }

      setIsAllowed(true);
      setIsReady(true);
    }

    void loadHeader();
  }, [siteName]);

  if (!isReady || !isAllowed || !siteName || !siteType) {
    return (
      <>
        {isMobile ? (
          <Box sx={{ position: 'relative' }}>
            <IconButton href={`/${siteName}`} aria-label="홈으로 이동" size="small" disabled>
              <CloseIcon />
            </IconButton>
            <Stack
              alignItems="center"
              sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', margin: 0 }}
            >
              <Stack justifyContent="center" alignItems="center" sx={{ margin: 0 }}>
                <LoadingIndicator size={32} />
              </Stack>
            </Stack>
          </Box>
        ) : (
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Stack alignItems="center" sx={{ height: '48px' }}>
              <Stack justifyContent="center" alignItems="center">
                <LoadingIndicator />
              </Stack>
            </Stack>
          </Box>
        )}
      </>
    );
  }

  const tabItems: StaffTabItem[] = [
    { label: '관리 홈', href: `/${siteName}/manage` },
    { label: siteType === 'blog' ? '블로그 정보' : '커뮤니티 정보', href: `/${siteName}/manage/settings` },
    ...(siteType === 'community' ? [{ label: '가입 관리', href: `/${siteName}/manage/join` }] : []),
    {
      label: siteType === 'blog' ? '팀원 관리' : '멤버 관리',
      href: siteType === 'blog' ? `/${siteName}/manage/team` : `/${siteName}/manage/members`,
    },
    { label: '콘텐츠 관리', href: `/${siteName}/manage/contents` },
    ...(siteType === 'community' ? [{ label: '제한된 콘텐츠', href: `/${siteName}/manage/filtered` }] : []),
    {
      label: '디자인',
      href: `/${siteName}/manage/design`,
    },
    { label: '통계', href: `/${siteName}/manage/stats` },
  ];

  const currentValue = getTabValue(pathname, tabItems);
  const isStaffHome = pathname === `/${siteName}/manage`;
  const mobileBackHref = getMobileBackHref(pathname, siteName);

  return (
    <>
      {isMobile ? (
        <Box sx={{ position: 'relative' }}>
          {isStaffHome ? (
            <>
              <IconButton href={`/${siteName}`} aria-label="홈으로 이동" size="small">
                <CloseIcon />
              </IconButton>
              <Typography
                variant="h6"
                component="h1"
                sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
              >
                커뮤니티 관리
              </Typography>
            </>
          ) : (
            <>
              <IconButton href={mobileBackHref} aria-label="뒤로가기" size="small">
                <ArrowBackIcon />
              </IconButton>
              <Typography
                variant="h6"
                component="h1"
                sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
              >
                {pageTitle}
              </Typography>
            </>
          )}
        </Box>
      ) : (
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentValue} variant="scrollable">
            {tabItems.map((tabItem) => (
              <LinkTab key={tabItem.href} label={tabItem.label} href={tabItem.href} value={tabItem.href} />
            ))}
          </Tabs>
        </Box>
      )}
    </>
  );
}
