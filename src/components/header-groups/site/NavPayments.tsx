'use client';

import { useParams, usePathname } from 'next/navigation';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import { useSiteHeader } from '@/app/(site)/[siteName]/SiteHeaderContext';
import styles from '@/app/header.module.sass';

type PaymentNavItem = {
  label: string;
  href: string;
  startsWith?: boolean;
};

function isCurrentPath(pathname: string, item: PaymentNavItem) {
  if (item.startsWith) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  return pathname === item.href;
}

export default function NavPayments() {
  const params = useParams();
  const pathname = usePathname();

  const siteName = normalizeText(params.siteName);

  const header = useSiteHeader();
  const isAllowed = Boolean(header);

  if (!isAllowed || !siteName) {
    return null;
  }

  const navItems: PaymentNavItem[] = [
    {
      label: '전체 거래 내역',
      href: `/${siteName}/payments/transactions`,
      startsWith: true,
    },
    {
      label: '전체 환불 내역',
      href: `/${siteName}/payments/refunds`,
      startsWith: true,
    },
    {
      label: '정산 예정',
      href: `/${siteName}/payments/scheduled`,
      startsWith: true,
    },
    {
      label: '정산 확정',
      href: `/${siteName}/payments/confirmed`,
      startsWith: true,
    },
    {
      label: '정산 완료',
      href: `/${siteName}/payments/completed`,
      startsWith: true,
    },
  ];

  const homeHref = `/${siteName}/payments`;
  const isHomeCurrent = pathname === homeHref;

  return (
    <div className={styles.navigationbar}>
      <nav>
        <ol>
          <li className={isHomeCurrent ? styles.current : undefined} aria-current={isHomeCurrent ? 'page' : false}>
            <Anchor href={homeHref}>
              <span>수익정산 홈</span>
              <i />
            </Anchor>
          </li>
          {navItems.map((item) => {
            const isCurrent = isCurrentPath(pathname, item);
            return (
              <li key={item.href} className={isCurrent ? styles.current : undefined}>
                <Anchor href={item.href} aria-current={isCurrent ? 'page' : undefined}>
                  <span>{item.label}</span>
                  <i />
                </Anchor>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
