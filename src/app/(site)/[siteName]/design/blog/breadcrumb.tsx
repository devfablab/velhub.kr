'use client';

import { useMemo } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import { normalizeText } from '@/lib/utils';

type Crumb = {
  href: string;
  label: string;
  startsWith?: boolean;
};

export default function BlogDesignBreadcrumb() {
  const pathname = usePathname();
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const crumbs: Crumb[] = useMemo(
    () => [
      { href: `/${siteName}/design/blog/fonts`, label: '기본 서체' },
      { href: `/${siteName}/design/blog/menu`, label: '메뉴' },
      { href: `/${siteName}/design/blog/links`, label: '링크' },
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
