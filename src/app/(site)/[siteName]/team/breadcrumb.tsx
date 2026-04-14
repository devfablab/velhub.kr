'use client';

import React, { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';

type Crumb = {
  href: string;
  label: string;
  startsWith?: boolean;
};

type BlogTeamBreadcrumbProps = {
  siteName: string;
};

export default function BlogTeamBreadcrumb({ siteName }: BlogTeamBreadcrumbProps) {
  const pathname = usePathname();

  const crumbs: Crumb[] = useMemo(
    () => [
      { href: `/${siteName}/team/members`, label: '팀원 목록' },
      { href: `/${siteName}/team/info`, label: '팀원 정보', startsWith: true },
    ],
    [siteName],
  );

  const isCurrent = (crumb: Crumb) => {
    if (crumb.href === '/') return pathname === '/';
    if (crumb.startsWith) return pathname.startsWith(crumb.href);
    return pathname === crumb.href;
  };

  return (
    <Breadcrumbs>
      {crumbs.map((crumb) =>
        isCurrent(crumb) ? (
          <Typography key={crumb.href}>{crumb.label}</Typography>
        ) : (
          <Link key={crumb.href} href={crumb.href} underline="hover" color="info">
            {crumb.label}
          </Link>
        ),
      )}
    </Breadcrumbs>
  );
}
