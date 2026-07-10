'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import styles from '@/app/header.module.sass';

type HeaderSiteResponse = {
  siteName: string | null;
  isLoggedIn: boolean;
  email: string | null;
  userName: string | null;
  avatar: string | null;
  themeMode: 'light' | 'system' | 'dark' | null;
  globalRole: string | null;
  siteRole: string | null;
  sessionCase?: string | null;
};

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

      setIsAllowed(true);
      setIsReady(true);
    }

    void loadHeader();
  }, [siteName]);

  if (!isReady || !isAllowed || !siteName) {
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
