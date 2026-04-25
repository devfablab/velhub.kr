'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useMediaQuery, useTheme } from '@mui/material';
import { normalizeText } from '@/lib/utils';
import HeaderSite from '@/components/headers/Site';
import { useEffect } from 'react';

const HIDE_PREFIXES = ['/contents', '/design', '/manage', '/', '/team', '/stats', '/members', '/filtered'];

function shouldHideHeader(pathname: string, siteName: string) {
  const normalizedSiteName = normalizeText(siteName);
  const basePath = `/${normalizedSiteName}/manage`;

  return HIDE_PREFIXES.some((prefix) => {
    const targetPath = `${basePath}${prefix}`;
    return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
  });
}

export default function HeaderSiteGuard() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const siteName = normalizeText(pathname.split('/')[1]);
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));
  const isMobile = !isNotMobile;

  useEffect(() => {
    const search = searchParams.toString();
    const currentPath = search ? `${pathname}?${search}` : pathname;
    sessionStorage.setItem('route:returnPath', currentPath);
  }, [pathname, searchParams]);

  if (!siteName || !isMobile) {
    return <HeaderSite />;
  }

  if (shouldHideHeader(pathname, siteName)) {
    return null;
  }

  return <HeaderSite />;
}
