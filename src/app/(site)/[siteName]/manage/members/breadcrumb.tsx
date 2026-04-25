'use client';

import { useMemo } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { normalizeText } from '@/lib/utils';

type Crumb = {
  href: string;
  label: string;
  startsWith?: boolean;
};

export default function SiteMembersBreadcrumb() {
  const pathname = usePathname();
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const crumbs: Crumb[] = useMemo(
    () => [
      { href: `/${siteName}/manage/members/entirety`, label: '활동멤버' },
      { href: `/${siteName}/manage/members/blocked`, label: '활동정지' },
      { href: `/${siteName}/manage/members/withdrawn`, label: '탈퇴멤버' },
      { href: `/${siteName}/manage/members/levels`, label: '멤버등급 관리' },
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
